FROM nvcr.io/nvidia/pytorch:26.08-py3

WORKDIR /opt/local-image-generator
COPY requirements.txt /tmp/local-image-generator-requirements.txt
RUN python3 -m pip install --no-cache-dir -r /tmp/local-image-generator-requirements.txt

ENTRYPOINT ["python3", "/runtime/run.py"]
