# play-c463-z26-rzy-mar-tech

An AI-powered marketing campaign management platform built on AWS. Users can create and manage marketing campaigns through a web interface and interact with an AI agent via chat to execute marketing tasks.

The solution is composed of:

- A React/TypeScript frontend with Cognito authentication, campaign management, and a real-time chat interface
- A TypeScript Lambda backend providing REST APIs for campaigns, chat, and agent configuration
- A Python-based AI agent powered by AWS Bedrock AgentCore and the Strands Agents framework
- AWS CDK infrastructure deploying to Lambda, DynamoDB, S3, API Gateway, Cognito, and Bedrock

## Prerequisites

- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) installed and configured
- [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/) installed
- [Docker](https://docs.docker.com/get-docker/) running locally

## Build & Deploy

### 1. Authenticate with AWS ECR Public

```sh
aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws
```

### 2. Build the project

```sh
pnpm run build:all
```

### 3. Deploy to AWS

```sh
pnpm exec nx deploy @play-c463-z26-rzy-mar-tech/infra "play-c463-z26-rzy-mar-tech-infra-sandbox/*"
```

## Serving the UI locally

After deploying at least once (so the backend resources exist), you can run the UI locally for development and testing.

Load the runtime config from your deployed stack:

```sh
pnpm exec nx run @play-c463-z26-rzy-mar-tech/web-ui:load:runtime-config
```

Start the local dev server:

```sh
pnpm exec nx serve @play-c463-z26-rzy-mar-tech/web-ui
```

This starts a Vite dev server with HMR enabled.

## Known issues

### Docker build failures due to Nx cache

Nx caching can reference Docker images that no longer exist locally, causing errors like:

```
error: no such object: databricks-agent:latest
```

To fix this, reset the Nx cache:

```sh
pnpm nx reset
```

Then re-run your build/deploy commands.
