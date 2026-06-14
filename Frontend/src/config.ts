interface EnvSettings {
  apiBaseUrl: string
  posthogApiKey?: string
  posthogHost: string
}

const getEnvVar = (name: string, isRequired = true): string => {
  const value = import.meta.env[name]
  if (!value && isRequired) {
    throw new Error(`Environment variable ${name} is missing`)
  }
  return value || ""
}

export const settings: EnvSettings = {
  apiBaseUrl: getEnvVar("VITE_API_BASE_URL", false),
  posthogApiKey: getEnvVar("VITE_POSTHOG_API_KEY", false),
  posthogHost: getEnvVar("VITE_POSTHOG_HOST", false),
}

export default settings
