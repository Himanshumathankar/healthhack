FROM golang:1.24-bookworm AS builder
ARG MINIO_VERSION=RELEASE.2025-04-22T22-12-26Z
RUN git clone --depth 1 --branch ${MINIO_VERSION} https://github.com/minio/minio.git /src
WORKDIR /src
RUN CGO_ENABLED=0 go build -trimpath -o /out/minio .

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /out/minio /usr/local/bin/minio
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
