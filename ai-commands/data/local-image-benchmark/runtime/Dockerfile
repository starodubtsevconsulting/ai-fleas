FROM nvcr.io/nvidia/pytorch:26.08-py3

WORKDIR /opt/gx10-image-benchmark
COPY requirements.txt /tmp/gx10-image-requirements.txt
RUN python3 -m pip install --no-cache-dir -r /tmp/gx10-image-requirements.txt

ENTRYPOINT ["python3", "/runtime/run.py"]
