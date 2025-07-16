FROM ghcr.io/sweber35/slippc-arrow-base:latest

RUN yum install -y make

WORKDIR /src/slippc
COPY . /src/slippc/

RUN echo "Listing /src/slippc contents:" && ls -alh /src/slippc
RUN echo "Dumping Makefile:" && cat /src/slippc/makefile || echo "Makefile not found"

ENV CPLUS_INCLUDE_PATH=/usr/local/include
ENV LIBRARY_PATH=/usr/local/lib

RUN mkdir -p build
RUN make clean || true
RUN make static
