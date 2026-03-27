import { Redirect } from 'expo-router'

// DEV BYPASS — change to '/(auth)/login' when auth is ready
export default function Index() {
  return <Redirect href="/(tabs)" />
}
