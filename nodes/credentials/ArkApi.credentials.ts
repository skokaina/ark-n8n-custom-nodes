import { ICredentialType, INodeProperties } from "n8n-workflow";

export class ArkApi implements ICredentialType {
  name = "arkApi";
  displayName = "ARK API";
  documentationUrl = "https://github.com/mckinsey/agents-at-scale-ark";

  properties: INodeProperties[] = [
    {
      displayName: "Base URL",
      name: "baseUrl",
      type: "string",
      default: "http://ark-api.default.svc.cluster.local",
      required: true,
      description: "The base URL of the ARK API service",
      placeholder: "http://ark-api.default.svc.cluster.local",
    },
    {
      displayName: "Namespace",
      name: "namespace",
      type: "string",
      default: "default",
      required: false,
      description: "Kubernetes namespace for ARK resources",
      placeholder: "default",
    },
    {
      displayName: "Authentication Scheme",
      name: "authScheme",
      type: "options",
      options: [
        {
          name: "None",
          value: "none",
          description: "No authentication (in-cluster access)",
        },
        {
          name: "Basic (API Key)",
          value: "basic",
          description:
            "Basic authentication using ARK API key (pk-ark-xxx:sk-ark-xxx)",
        },
        {
          name: "Bearer Token",
          value: "bearer",
          description:
            "Bearer token authentication (JWT or service account token)",
        },
      ],
      default: "none",
      description: "The authentication scheme to use for ARK API requests",
    },
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: {
        password: true,
      },
      default: "",
      required: true,
      description: "ARK API key (format: pk-ark-xxx:sk-ark-xxx)",
      placeholder: "pk-ark-xxx:sk-ark-xxx",
      displayOptions: {
        show: {
          authScheme: ["basic"],
        },
      },
    },
    {
      displayName: "Bearer Token",
      name: "bearerToken",
      type: "string",
      typeOptions: {
        password: true,
      },
      default: "",
      required: true,
      description:
        "Bearer token for authentication (JWT, service account token, or other token)",
      placeholder: "eyJhbGciOiJSUzI1NiIs...",
      displayOptions: {
        show: {
          authScheme: ["bearer"],
        },
      },
    },
  ];
}
