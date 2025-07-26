from werkzeug.utils import secure_filename
import shutil
from flask_cors import CORS
from dotenv import load_dotenv
import os
import google.generativeai as genai
import warnings
import json
import requests
from flask import Flask, request, jsonify, send_file
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.prompts import ChatPromptTemplate

# Get absolute path to the directory where this app.py script lives
basedir = os.path.abspath(os.path.dirname(__file__))
# Path to frontend's 'dist' folder
dist_dir = os.path.join(basedir, "../Project2/project/dist")

# Initialize Flask app
app = Flask(__name__, static_folder=dist_dir, static_url_path='')
CORS(app)

# Load environment variables
load_dotenv()

# Suppress LangChain and Chroma warnings
warnings.filterwarnings("ignore", category=UserWarning, module="langchain")
warnings.filterwarnings("ignore", category=DeprecationWarning, module="langchain")

# Configure Gemini API
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY environment variable is not set.")
genai.configure(api_key=GOOGLE_API_KEY)

# Paths and embedding function
CHROMA_PATH = "chroma"
em_func = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

# Load Chroma database
try:
    db = Chroma(persist_directory=CHROMA_PATH, embedding_function=em_func)
except Exception as e:
    print(f"ChromaDB not found at startup: {e}")
    db = None

def perform_web_search(query, api_key, num_results=3):
    try:
        params = {
            "engine": "google",
            "q": query,
            "api_key": api_key,
            "num": num_results
        }
        res = requests.get("https://serpapi.com/search", params=params)
        results = res.json().get("organic_results", [])
        if not results:
            return "No search results found."
        return "\n".join([f"- [{r['title']}]({r['link']})" for r in results])
    except Exception as e:
        return f"Error during web search: {str(e)}"

# Manager LLM prompt template
MANAGER_PROMPT_TEMPLATE = """
You are a Manager LLM for a Personal Finance Advisor. Your task is to analyze the user query to determine if a database search (RAG) or web search is needed, and return a JSON object with the following fields:
- "RAG_needed": "yes" if the query involves financial topics (e.g., budgeting, savings, investments), otherwise "no".
- "websearch_needed": "yes" if the query requires real-time or external data (e.g., current stock prices, recent financial news), otherwise "no".
- "prompt": the original user query.
- "context": leave empty for now (to be populated later if RAG_needed is "yes").

**Input**:
User Query: {query}

**Instructions**:
- Output only a valid JSON object, no additional text.
- Set "RAG_needed" to "yes" for queries about budgeting, savings, investments, or financial habits.
- Set "websearch_needed" to "yes" for queries about real-time data or recent events.
- Include the full user query as "prompt".
- Set "context" to an empty string.

**Output Format**:
{{
    "RAG_needed": "yes/no",
    "websearch_needed": "yes/no",
    "prompt": "{query}",
    "context": ""
}}
"""

# Advisor LLM prompt template
ADVISOR_PROMPT_TEMPLATE = """
You are an Advisor LLM for a Personal Finance Advisor. Your task is to take a JSON object from the Manager LLM and provide a conversational response to the user's query, including a decision suggestion based on financial best practices.

**Input JSON**:
{manager_json}

**Instructions**:
- Use the "prompt" and "context" from the JSON to answer the query.
- If "websearch_needed" is "yes", note that real-time data is included in the context as web search links, or acknowledge if unavailable.
- If "RAG_needed" is "no", respond based on general financial knowledge or acknowledge non-financial queries.
- Provide a concise, user-friendly response addressing the query.
- Include a **Suggestion** section with actionable financial advice tailored to the query and context.
- If the context is empty or irrelevant, use general financial knowledge.
- Output only the conversational response, no JSON, formatted with markdown for emphasis (e.g., **Suggestion**).

**Example**:
- Input: {{"RAG_needed": "yes", "websearch_needed": "yes", "prompt": "What is my money flow pattern in March?", "context": "April data: Income $5,200, Expenses $3,800...\n\n---\n\n**Web Search Results**:\n- [Finance Site](https://example.com)"}}
- Output: I don't have March 2025 data, but based on your April 2025 patterns, your income was $5,200 with expenses of $3,800 (housing, utilities, dining out). You saved $1,000 and invested $400. Check the web search results for more insights. **Suggestion**: Track March expenses in a budgeting app like YNAB to identify patterns.
- Input: {{"RAG_needed": "no", "websearch_needed": "no", "prompt": "Hi", "context": ""}}
- Output: Hello! I'm here to help with your financial questions. **Suggestion**: Ask about budgeting, savings, or investments to get personalized advice!
"""

# Initialize Gemini model
model = genai.GenerativeModel('gemini-1.5-flash')

# Configure upload settings
UPLOAD_FOLDER = './Doc'
ALLOWED_EXTENSIONS = {'docx'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Custom static file route to set correct MIME types
@app.route('/assets/<path:filename>')
def serve_static(filename):
    file_path = os.path.join(dist_dir, 'assets', filename)
    if not os.path.exists(file_path):
        return jsonify({'error': 'File not found'}), 404
    # Set MIME type based on file extension
    if filename.endswith('.js'):
        return send_file(file_path, mimetype='application/javascript')
    elif filename.endswith('.css'):
        return send_file(file_path, mimetype='text/css')
    elif filename.endswith('.html'):
        return send_file(file_path, mimetype='text/html')
    else:
        return send_file(file_path)

# API Route for uploading documents
@app.route('/upload', methods=['POST'])
def upload_document():
    try:
        if 'document' not in request.files:
            return jsonify({'success': False, 'message': 'No file provided'})
        file = request.files['document']
        if file.filename == '':
            return jsonify({'success': False, 'message': 'No file selected'})
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            try:
                from creat_vec_database import main as create_vector_db
                create_vector_db()
                global db
                db = Chroma(persist_directory=CHROMA_PATH, embedding_function=em_func)
                return jsonify({
                    'success': True,
                    'message': f'Document "{filename}" uploaded and processed successfully!'
                })
            except Exception as e:
                return jsonify({
                    'success': False,
                    'message': f'Document uploaded but failed to process: {str(e)}'
                })
        return jsonify({'success': False, 'message': 'Invalid file type. Please upload a .docx file'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'Upload failed: {str(e)}'})

# API Route for processing queries
@app.route('/query', methods=['POST'])
def process_query():
    global db
    if db is None:
        return jsonify({'advisor_response': 'The knowledge base is not yet initialized. Please upload a document first.'})
    data = request.get_json()
    query_text = data.get('query', '')
    search_links_md = ""
    if query_text.lower() in ['exit', 'quit', 'bye']:
        return jsonify({'response': 'Goodbye!'})
    manager_prompt_template = ChatPromptTemplate.from_template(MANAGER_PROMPT_TEMPLATE)
    manager_prompt = manager_prompt_template.format_messages(query=query_text)
    try:
        manager_response = model.generate_content(manager_prompt[0].content)
        cleaned_text = manager_response.text.strip()
        if cleaned_text.startswith("```json"):
            cleaned_text = cleaned_text[7:].strip()
        elif cleaned_text.startswith("```"):
            cleaned_text = cleaned_text[3:].strip()
        if cleaned_text.endswith("```"):
            cleaned_text = cleaned_text[:-3].strip()
        try:
            manager_json = json.loads(cleaned_text)
            if manager_json.get("RAG_needed") == "yes":
                result = db.similarity_search(query_text, k=3)
                manager_json["context"] = "\n\n---\n\n".join([doc.page_content for doc in result])
            if manager_json.get("websearch_needed") == "yes":
                serpapi_key = os.environ.get("SERPAPI_API_KEY")
                if not serpapi_key:
                    manager_json["context"] += "\n\n---\n\n**Web Search Results**: SERPAPI_API_KEY not set."
                else:
                    search_links_md = perform_web_search(manager_json["prompt"], serpapi_key)
                    manager_json["context"] += "\n\n---\n\n**Web Search Results**:\n" + search_links_md
            advisor_prompt_template = ChatPromptTemplate.from_template(ADVISOR_PROMPT_TEMPLATE)
            advisor_prompt = advisor_prompt_template.format_messages(manager_json=json.dumps(manager_json))
            try:
                advisor_response = model.generate_content(advisor_prompt[0].content)
                return jsonify({
                    'manager_response': manager_json,
                    'advisor_response': advisor_response.text,
                    'web_links': search_links_md
                })
            except Exception as e:
                return jsonify({
                    'manager_response': manager_json,
                    'advisor_response': {'error': f"Error generating response with Advisor LLM: {str(e)}"},
                    'web_links': search_links_md
                })
        except json.JSONDecodeError:
            return jsonify({
                'manager_response': {'error': 'Invalid JSON from Manager LLM', 'raw': cleaned_text},
                'advisor_response': None,
                'web_links': ""
            })
    except Exception as e:
        return jsonify({
            'manager_response': {'error': f"Error generating response with Manager LLM: {str(e)}"},
            'advisor_response': None,
            'web_links': ""
        })

# Serve index.html for all non-API routes
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    return send_file(os.path.join(dist_dir, 'index.html'), mimetype='text/html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)