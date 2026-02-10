import {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from "n8n-workflow";

export class N8nApi implements ICredentialType {
  name = "n8nApi";
  displayName = "n8n API";
  documentationUrl = "https://docs.n8n.io/api/";
  properties: INodeProperties[] = [
    {
      displayName: "API URL",
      name: "baseUrl",
      type: "string",
      default: "http://localhost:5678",
      placeholder: "http://n8n.default.svc.cluster.local:5678",
      description: "The base URL of your n8n instance",
      required: true,
    },
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: {
        password: true,
      },
      default: "",
      description: "n8n API key for authentication",
      required: true,
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: "generic",
    properties: {
      headers: {
        "X-N8N-API-KEY": "={{$credentials.apiKey}}",
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: "={{$credentials.baseUrl}}",
      url: "/api/v1/workflows",
      method: "GET",
    },
  };
}
