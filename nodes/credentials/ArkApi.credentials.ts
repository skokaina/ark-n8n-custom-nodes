import {
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class ArkApi implements ICredentialType {
  name = 'arkApi';
  displayName = 'ARK API';
  documentationUrl = 'https://github.com/mckinsey/agents-at-scale-ark';

  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'http://ark-api.default.svc.cluster.local',
      required: true,
      description: 'The base URL of the ARK API service',
      placeholder: 'http://ark-api.default.svc.cluster.local',
    },
    {
      displayName: 'API Token',
      name: 'token',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      required: false,
      description: 'Optional API token for authentication (future use)',
    },
  ];
}
