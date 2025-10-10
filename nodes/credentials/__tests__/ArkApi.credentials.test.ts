import { ArkApi } from '../ArkApi.credentials';
import { ICredentialType } from 'n8n-workflow';

describe('ArkApi', () => {
  let credentials: ArkApi;

  beforeEach(() => {
    credentials = new ArkApi();
  });

  describe('Metadata', () => {
    it('should have correct name', () => {
      expect(credentials.name).toBe('arkApi');
    });

    it('should have correct display name', () => {
      expect(credentials.displayName).toBe('ARK API');
    });

    it('should have documentation URL', () => {
      expect(credentials.documentationUrl).toBeDefined();
      expect(credentials.documentationUrl).toContain('ark');
    });
  });

  describe('Properties', () => {
    it('should have baseUrl property', () => {
      const baseUrlProperty = credentials.properties.find(
        (p) => p.name === 'baseUrl'
      );

      expect(baseUrlProperty).toBeDefined();
      expect(baseUrlProperty?.displayName).toBe('Base URL');
      expect(baseUrlProperty?.type).toBe('string');
      expect(baseUrlProperty?.required).toBe(true);
      expect(baseUrlProperty?.default).toBe('http://ark-api.default.svc.cluster.local');
    });

    it('should have optional token property', () => {
      const tokenProperty = credentials.properties.find(
        (p) => p.name === 'token'
      );

      expect(tokenProperty).toBeDefined();
      expect(tokenProperty?.displayName).toBe('API Token');
      expect(tokenProperty?.type).toBe('string');
      expect(tokenProperty?.typeOptions?.password).toBe(true);
      expect(tokenProperty?.required).toBe(false);
    });

    it('should have all required fields', () => {
      expect(credentials.properties).toHaveLength(2);
    });
  });

  describe('Type', () => {
    it('should implement ICredentialType interface', () => {
      expect(credentials).toHaveProperty('name');
      expect(credentials).toHaveProperty('displayName');
      expect(credentials).toHaveProperty('properties');
    });
  });
});
