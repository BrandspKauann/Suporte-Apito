FROM golang:1.27-alpine AS builder
RUN apk add --no-cache git build-base
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# The frontend is deployed independently by Vercel.
RUN mkdir -p frontend/dist && printf '<!doctype html><title>Apito de Mestre API</title>' > frontend/dist/index.html
RUN CGO_ENABLED=1 go build -tags netgo -trimpath -ldflags '-X code.vikunja.io/api/pkg/version.Version=2.8.0-central.1' -o /out/vikunja .
FROM node:24-alpine
RUN apk add --no-cache ca-certificates tzdata libgcc libstdc++
COPY --from=builder /out/vikunja /usr/local/bin/vikunja
WORKDIR /opt/apito
COPY deploy/vercel-api/config.mjs deploy/vercel-api/start.mjs ./
COPY LICENSE ./LICENSE
LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later"
ENV NODE_ENV=production
USER node
EXPOSE 80
CMD ["node", "start.mjs"]
