# Agentic AI for Martech

An AI-powered marketing campaign management platform built on AWS. Users can create and manage marketing campaigns through a web interface and interact with an AI agent via chat to execute marketing tasks.

The solution is composed of:

- A React/TypeScript frontend with Cognito authentication, campaign management, and a real-time chat interface
- A TypeScript Lambda backend providing REST APIs for campaigns, chat, and agent configuration
- A Python-based AI agent powered by AWS Bedrock AgentCore and the Strands Agents framework
- AWS CDK infrastructure deploying to Lambda, DynamoDB, S3, API Gateway, Cognito, and Bedrock

## Documentation

For detailed technical documentation on every component, see the [Technical Documentation](./docs/README.md).

## Architecture

![architecture](./docs/architecture.jpg)

## Prerequisites

- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) installed and configured
- [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/) installed
- [Python 3.14](https://www.python.org/downloads/) and [uv](https://docs.astral.sh/uv/getting-started/installation/) installed
- [Docker](https://docs.docker.com/get-docker/) running locally

## Configuration

Before deploying, update `packages/infra/config/default.yaml` with your environment-specific values:

- `deploymentConfig.adminUser.email` — email for the initial Cognito admin user
- `deploymentConfig.mcp.databricks.token` and `url` — your Databricks workspace credentials
- `deploymentConfig.mcp.clevertap.projectId`, `passcode`, and `region` — your CleverTap project credentials
- `deploymentConfig.mcp.talonone.baseUrl`, `applicationId`, `managementKey`, and `integrationKey` — your TalonOne credentials

Only the integrations you plan to use need to be configured. Unused ones can be left empty.

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

### WebUI `Network Error`

The Web-UI may return `Network Error` during the chat. To fix, just refresh the page to get the update from the agent. If the answer seems like it's not completed yet, refresh again.

## License

This project is licensed under the [Amazon Software License](https://aws.amazon.com/asl/) (SPDX: `LicenseRef-.amazon.com.-AmznSL-1.0`). See the [LICENSE](./LICENSE) file for details.
