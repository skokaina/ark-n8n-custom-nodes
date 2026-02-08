import { ArkApi } from "../ArkApi.credentials";

describe("ArkApi", () => {
  let credentials: ArkApi;

  beforeEach(() => {
    credentials = new ArkApi();
  });

  describe("Metadata", () => {
    it("should have correct name", () => {
      expect(credentials.name).toBe("arkApi");
    });

    it("should have correct display name", () => {
      expect(credentials.displayName).toBe("ARK API");
    });

    it("should have documentation URL", () => {
      expect(credentials.documentationUrl).toBeDefined();
      expect(credentials.documentationUrl).toContain("ark");
    });
  });

  describe("Properties", () => {
    it("should have baseUrl property", () => {
      const baseUrlProperty = credentials.properties.find(
        (p) => p.name === "baseUrl",
      );

      expect(baseUrlProperty).toBeDefined();
      expect(baseUrlProperty?.displayName).toBe("Base URL");
      expect(baseUrlProperty?.type).toBe("string");
      expect(baseUrlProperty?.required).toBe(true);
      expect(baseUrlProperty?.default).toBe(
        "http://ark-api.default.svc.cluster.local",
      );
    });

    it("should have namespace property", () => {
      const namespaceProperty = credentials.properties.find(
        (p) => p.name === "namespace",
      );

      expect(namespaceProperty).toBeDefined();
      expect(namespaceProperty?.displayName).toBe("Namespace");
      expect(namespaceProperty?.type).toBe("string");
      expect(namespaceProperty?.required).toBe(false);
      expect(namespaceProperty?.default).toBe("default");
    });

    it("should have authScheme property with three options", () => {
      const authSchemeProperty = credentials.properties.find(
        (p) => p.name === "authScheme",
      );

      expect(authSchemeProperty).toBeDefined();
      expect(authSchemeProperty?.displayName).toBe("Authentication Scheme");
      expect(authSchemeProperty?.type).toBe("options");
      expect(authSchemeProperty?.default).toBe("none");

      const options = (authSchemeProperty as any)?.options;
      expect(options).toHaveLength(3);
      expect(options.map((o: any) => o.value)).toEqual([
        "none",
        "basic",
        "bearer",
      ]);
    });

    it("should have apiKey property shown only for basic auth", () => {
      const apiKeyProperty = credentials.properties.find(
        (p) => p.name === "apiKey",
      );

      expect(apiKeyProperty).toBeDefined();
      expect(apiKeyProperty?.displayName).toBe("API Key");
      expect(apiKeyProperty?.type).toBe("string");
      expect(apiKeyProperty?.typeOptions?.password).toBe(true);
      expect(apiKeyProperty?.required).toBe(true);
      expect((apiKeyProperty as any)?.displayOptions?.show?.authScheme).toEqual(
        ["basic"],
      );
    });

    it("should have bearerToken property shown only for bearer auth", () => {
      const bearerTokenProperty = credentials.properties.find(
        (p) => p.name === "bearerToken",
      );

      expect(bearerTokenProperty).toBeDefined();
      expect(bearerTokenProperty?.displayName).toBe("Bearer Token");
      expect(bearerTokenProperty?.type).toBe("string");
      expect(bearerTokenProperty?.typeOptions?.password).toBe(true);
      expect(bearerTokenProperty?.required).toBe(true);
      expect(
        (bearerTokenProperty as any)?.displayOptions?.show?.authScheme,
      ).toEqual(["bearer"]);
    });

    it("should have all required fields", () => {
      expect(credentials.properties).toHaveLength(5);
      expect(credentials.properties.map((p) => p.name)).toEqual([
        "baseUrl",
        "namespace",
        "authScheme",
        "apiKey",
        "bearerToken",
      ]);
    });
  });

  describe("Type", () => {
    it("should implement ICredentialType interface", () => {
      expect(credentials).toHaveProperty("name");
      expect(credentials).toHaveProperty("displayName");
      expect(credentials).toHaveProperty("properties");
    });
  });
});
