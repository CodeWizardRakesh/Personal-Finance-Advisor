# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Create a non-root user for security
RUN useradd -m -u 1000 user
USER user

# Set environment variables so Python and pip work correctly
ENV PATH="/home/user/.local/bin:${PATH}"
ENV PYTHONUNBUFFERED=1

# Copy the requirements file first to take advantage of Docker caching
COPY --chown=user ./requirements.txt .

# Install the Python packages
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Copy the rest of your project files into the container
COPY --chown=user . .

# Tell Docker that the container listens on port 7860
EXPOSE 7860

# The command to run your app using Gunicorn
# It changes into the 'backend' folder, then runs the app
CMD ["gunicorn", "--chdir", "backend", "app:app", "--bind", "0.0.0.0:7860"]