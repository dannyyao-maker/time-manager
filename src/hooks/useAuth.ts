import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type Role = 'owner' | 'editor' | 'viewer'

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'no-access'; session: Session }
  | { status: 'member'; session: Session; role: Role; displayName: string }
  | { status: 'error'; message: string }

// 目前登入的人是誰、在不在成員名單上、是什麼角色
export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  useEffect(() => {
    if (session === undefined) return
    if (session === null) {
      setState({ status: 'signed-out' })
      return
    }

    let cancelled = false
    setState({ status: 'loading' })

    // RLS 規則只允許讀到「自己那一列」：不在名單上就會是空的
    supabase
      .from('members')
      .select('role, display_name')
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setState({ status: 'error', message: error.message })
        } else if (!data) {
          setState({ status: 'no-access', session })
        } else {
          const fallbackName =
            (session.user.user_metadata?.full_name as string | undefined) ?? '你'
          setState({
            status: 'member',
            session,
            role: data.role as Role,
            displayName: data.display_name ?? fallbackName,
          })
        }
      })

    return () => {
      cancelled = true
    }
    // 只在「換了一個人」或登入／登出時重新查名單，避免每次更新登入憑證都重查
  }, [userId, session === null])

  return state
}

export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
}

export function signOut() {
  return supabase.auth.signOut()
}
