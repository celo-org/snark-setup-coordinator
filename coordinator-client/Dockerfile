FROM rust:1.47 as rustbase

RUN apt update && \
    apt install -y \
    cmake \
    clang \
    gcc \
    g++ \
    zlib1g-dev \
    libmpc-dev \
    libmpfr-dev \
    libgmp-dev \
    musl-tools \
    build-essential \
    gcc-mingw-w64-x86-64 \
    && rm -rf /var/lib/apt/lists/*

RUN rustup target add x86_64-apple-darwin x86_64-unknown-linux-musl x86_64-pc-windows-gnu

RUN git clone https://github.com/tpoechtrager/osxcross && \
    cd osxcross && \
    wget -nc https://s3.dockerproject.org/darwin/v2/MacOSX10.10.sdk.tar.xz && \
    mv MacOSX10.10.sdk.tar.xz tarballs/ && \
    UNATTENDED=yes OSX_VERSION_MIN=10.7 ./build.sh

WORKDIR /app
COPY . .

RUN cd /app/snark-setup && \
    cargo build --release --target x86_64-unknown-linux-musl --bin phase1 && \
    cargo build --release --target x86_64-pc-windows-gnu --bin phase1 && \
    CC="/osxcross/target/bin/o64-clang" CXX="/osxcross/target/bin/o64-clang++" RUSTFLAGS="-C linker=/osxcross/target/bin/x86_64-apple-darwin14-clang -C ar=/osxcross/target/bin/x86_64-apple-darwin14-ar" cargo build --release --target x86_64-apple-darwin --bin phase1

FROM node:12.18.3-alpine3.12 as base

ENV NPM_CONFIG_LOGLEVEL info

# @celo/utils has depdencies in github
RUN apk update && apk upgrade && \
    apk add --no-cache git

WORKDIR /app
COPY package*.json ./
RUN npm ci

# Copy app
COPY . .

RUN npm run build

FROM node:12.18.3-alpine3.12

# Ensure we only install dependencies (not devDependencies too)
ENV NODE_ENV production
ENV NPM_CONFIG_LOGLEVEL info

# @celo/utils has depdencies in github
RUN apk update && apk upgrade && \
    apk add --no-cache git

WORKDIR /app
COPY package*.json ./
RUN npm ci
RUN mkdir powersoftau

# Copy build files
COPY --from=base /app/dist ./dist
COPY --from=rustbase /app/snark-setup/target/x86_64-apple-darwin/release/phase1 ./powersoftau/powersoftau_macos.uu
COPY --from=rustbase /app/snark-setup/target/x86_64-unknown-linux-musl/release/phase1 ./powersoftau/powersoftau_linux_musl.file
COPY --from=rustbase /app/snark-setup/target/x86_64-pc-windows-gnu/release/phase1.exe ./powersoftau/powersoftau.exe
