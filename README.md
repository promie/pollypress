# PollyPress

A serverless text-to-speech application built with AWS CDK, React, API Gateway, Lambda, and Amazon Polly.

![Architecture Diagram](./architecture.png)

## Features
- **Serverless Architecture**: Fully serverless backend using AWS Lambda and API Gateway.
- **React Frontend**: Interactive frontend built with Vite and React.
- **Text-to-Speech**: Converts text files to audio using Amazon Polly.
- **Asynchronous Processing**: Scalable event-driven architecture with SQS.
- **Infrastructure as Code**: Complete infrastructure defined in AWS CDK.
- **Secure Hosting**: Frontend delivered via CloudFront and S3 with HTTPS.

## Architecture

The system follows a clean, serverless architecture:
1.  **Frontend**: Users access the React application hosted on S3 and served via CloudFront.
2.  **API**: API Gateway routes RESTful requests to specific Lambda handlers.
3.  **Logic**: Node.js Lambda functions handle uploads, downloads, and event processing.
4.  **Processing**: SQS and Lambda coordinate with Amazon Polly for speech synthesis.
5.  **Storage**: S3 stores input text files and output audio files.

## Prerequisites

- Node.js (v22.x)
- AWS CLI configured with appropriate credentials (profile `promie`)
- AWS CDK installed globally (`npm install -g aws-cdk`)

## Quick Start

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Deploy to AWS**
    ```bash
    npm run deploy
    ```

3.  **Run Frontend Locally**
    ```bash
    npm run dev
    ```

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/upload` | Request presigned upload URL |
| `GET` | `/download` | Request presigned download URL |
| `GET` | `/status` | API health check |

## Project Structure

- `frontend/`: React application and assets.
- `app/`: Lambda handlers and business logic.
- `infra/`: AWS CDK infrastructure stacks and constructs.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
