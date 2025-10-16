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
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: {
        password: true,
      },
      default: "",
      required: false,
      description: "Optional API key for authentication (format: pk-ark-xxx:sk-ark-xxx)",
      placeholder: "pk-ark-xxx:sk-ark-xxx",
    },
    {
      displayName: "API Token",
      name: "token",
      type: "string",
      typeOptions: {
        password: true,
      },
      default: "",
      required: false,
      description: "Optional API token for authentication (legacy, use API Key instead)",
    },
  ];
}
