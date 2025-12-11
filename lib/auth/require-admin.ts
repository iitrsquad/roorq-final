import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type UserRole = 'customer' | 'admin' | 'super_admin'

export interface AdminUser {
  id: string
  email: string
  role: UserRole
}

/**
 * Server-side function to require admin access.
 * Use this at the top of any admin page or layout.
 * Redirects to homepage if user is not an admin.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createClient()
  
  // Get current authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/auth?error=unauthorized&message=Please+login+to+continue')
  }
  
  // Fetch user's role using security definer function to avoid RLS recursion
  const { data: roleData, error: roleError } = await supabase
    .rpc('get_user_role', { user_id: user.id })
  
  if (roleError) {
    console.error('Failed to fetch user role:', roleError)
    redirect('/?error=role-check-failed')
  }
  
  const userRole = roleData as string
  
  // Check if user has admin privileges
  const allowedRoles: UserRole[] = ['admin', 'super_admin']
  
  if (!allowedRoles.includes(userRole as UserRole)) {
    redirect('/?error=admin-access-denied&message=You+do+not+have+admin+privileges')
  }
  
  return {
    id: user.id,
    email: user.email || '',
    role: userRole as UserRole
  }
}

/**
 * Check if a user role has admin privileges
 */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'super_admin'
}

/**
 * Check if a user role is super admin
 */
export function isSuperAdmin(role: string | null | undefined): boolean {
  return role === 'super_admin'
}

