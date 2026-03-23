FROM python:3.13-slim

WORKDIR /app
RUN pip install uv

COPY pyproject.toml .
COPY config.yaml .
COPY start.sh .

RUN uv pip install --system -r pyproject.toml
RUN chmod +x start.sh

EXPOSE 8080
CMD ["./start.sh"]
