/** Authorization settings for a component */
export interface AuthorizationDefinition {
  /** Whether authorization is required */
  required: boolean;
  /** Supported authorization methods */
  methods: AuthorizationMethod[];
}

const authorizationMethods = [
  "basic",
  "api_key",
  "api_key_secret",
  "private_key",
  "oauth2",
  "oauth2_client_credentials",
] as const;

export type AuthorizationMethod = typeof authorizationMethods[number];

export const AvailableAuthorizationMethods: AuthorizationMethod[] = [
  ...authorizationMethods,
];

const oauth2AuthorizationMethods = [
  "oauth2",
  "oauth2_client_credentials",
] as const;

export type OAuth2AuthorizationMethod = typeof oauth2AuthorizationMethods[number];

export const AvailableOAuth2AuthorizationMethods: OAuth2AuthorizationMethod[] = [
  ...oauth2AuthorizationMethods,
];
