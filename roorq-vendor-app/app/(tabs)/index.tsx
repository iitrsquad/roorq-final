import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ViewStyle, TextStyle, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Colors, Spacing, Radius, Size, FontSize, FontWeight } from '@/theme'
import { supabase } from '@/lib/supabase'

type DashboardData = {
  name: string
  earnedMonth: number
  pendingPayout: number
  listed: number
  sold: number
}

type ActivityItem = {
  id: string
  label: string
  time: string
  amount: string
  color: string
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

const EMPTY: DashboardData = { name: 'there', earnedMonth: 0, pendingPayout: 0, listed: 0, sold: 0 }

export default function DashboardScreen() {
  const router = useRouter()
  const [data, setData]         = useState<DashboardData>(EMPTY)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { load() }, [])

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const now       = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      // Run all queries in parallel
      const [
        { count: listed },
        { count: sold },
        { data: soldProducts },
        { data: recentProducts },
      ] = await Promise.all([
        // All active listings
        supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true),

        // Sold (stock = 0)
        supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('stock_quantity', 0),

        // Sold this month — for earnings calc
        supabase
          .from('products')
          .select('vendor_price, updated_at')
          .eq('stock_quantity', 0)
          .gte('updated_at', monthStart),

        // Recent 5 products for activity feed
        supabase
          .from('products')
          .select('id, name, vendor_price, stock_quantity, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      // Sum earnings from sold products this month
      const earnedMonth = (soldProducts ?? []).reduce(
        (sum, p) => sum + (Number(p.vendor_price) || 0), 0
      )

      setData({
        name:          'Harish',   // swap with session.user.name when auth ready
        earnedMonth:   Math.floor(earnedMonth),
        pendingPayout: 0,          // needs orders/payouts table — Step 9+
        listed:        listed ?? 0,
        sold:          sold ?? 0,
      })

      // Build activity feed from recent products
      const feed: ActivityItem[] = (recentProducts ?? []).map(p => ({
        id:     p.id,
        label:  p.stock_quantity === 0
                  ? `${p.name} sold`
                  : `${p.name} listed`,
        time:   timeAgo(p.created_at),
        amount: p.stock_quantity === 0
                  ? `+₹${Math.floor(Number(p.vendor_price)).toLocaleString('en-IN')}`
                  : '',
        color:  p.stock_quantity === 0 ? Colors.GREEN : Colors.MUTED,
      }))
      setActivity(feed)

    } catch (e) {
      // keep previous data on error
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const fmt = (n: number) => n.toLocaleString('en-IN')

  return (
    <ScrollView
      style={vs.screen}
      contentContainerStyle={vs.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={Colors.RED}
          colors={[Colors.RED]}
        />
      }
    >
      {/* Header */}
      <View style={vs.header}>
        <Text style={ts.greeting}>{greeting()}, {data.name} 👋</Text>
        <Text style={ts.headerSub}>Here's your store overview</Text>
      </View>

      {/* Earnings card */}
      <View style={vs.earningsCard}>
        <Text style={ts.earningsLabel}>Earned this month</Text>
        <Text style={ts.earningsAmount}>
          {loading ? '—' : `₹${fmt(data.earnedMonth)}`}
        </Text>
        <View style={vs.earningsDivider} />
        <Text style={ts.earningsSub}>
          {data.sold > 0
            ? `${data.sold} item${data.sold > 1 ? 's' : ''} sold total`
            : 'No sales yet — list your first item below!'}
        </Text>
      </View>

      {/* Camera / List button */}
      <View style={vs.cameraSection}>
        <TouchableOpacity
          style={vs.cameraBtn}
          onPress={() => router.push('/list-item')}
          activeOpacity={0.85}
        >
          <Text style={ts.cameraIcon}>📷</Text>
        </TouchableOpacity>
        <Text style={ts.cameraLabel}>List an item</Text>
      </View>

      {/* Stats row */}
      <View style={vs.statsRow}>
        {[
          { label: 'Listed', value: loading ? '—' : String(data.listed) },
          { label: 'Sold',   value: loading ? '—' : String(data.sold)   },
          { label: 'Views',  value: '—' },
        ].map((s) => (
          <View key={s.label} style={vs.statCard}>
            <Text style={ts.statValue}>{s.value}</Text>
            <Text style={ts.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Recent activity */}
      <Text style={ts.sectionTitle}>Recent activity</Text>
      <View style={vs.activityCard}>
        {activity.length === 0 ? (
          <View style={vs.emptyActivity}>
            <Text style={ts.emptyText}>
              {loading ? 'Loading...' : 'No activity yet.\nList your first item to get started!'}
            </Text>
          </View>
        ) : (
          activity.map((item, i) => (
            <View
              key={item.id}
              style={[vs.activityRow, i < activity.length - 1 && vs.activityBorder]}
            >
              <View style={vs.activityLeft}>
                <Text style={ts.activityLabel}>{item.label}</Text>
                <Text style={ts.activityTime}>{item.time}</Text>
              </View>
              {item.amount ? (
                <Text style={[ts.activityAmount, { color: item.color }]}>{item.amount}</Text>
              ) : null}
            </View>
          ))
        )}
      </View>

      {/* Pull to refresh hint */}
      <Text style={ts.refreshHint}>Pull down to refresh</Text>

    </ScrollView>
  )
}

const vs = StyleSheet.create<Record<string, ViewStyle>>({
  screen:          { flex: 1, backgroundColor: Colors.CREAM },
  content:         { paddingHorizontal: Spacing.MD, paddingTop: 60, paddingBottom: 40 },
  header:          { marginBottom: Spacing.MD },
  earningsCard:    { backgroundColor: Colors.WHITE, borderRadius: Radius.SHEET, padding: Spacing.MD, marginBottom: Spacing.MD, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  earningsDivider: { height: 1, backgroundColor: Colors.BORDER, marginVertical: Spacing.SM },
  cameraSection:   { alignItems: 'center', marginVertical: Spacing.LG },
  cameraBtn:       { width: Size.CAMERA_BUTTON, height: Size.CAMERA_BUTTON, borderRadius: Size.CAMERA_BUTTON / 2, backgroundColor: Colors.RED, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.RED, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  statsRow:        { flexDirection: 'row', gap: Spacing.XS, marginBottom: Spacing.LG },
  statCard:        { flex: 1, backgroundColor: Colors.WHITE, borderRadius: Radius.CARD, padding: Spacing.SM, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  activityCard:    { backgroundColor: Colors.WHITE, borderRadius: Radius.CARD, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  activityRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.SM, paddingVertical: 14 },
  activityBorder:  { borderBottomWidth: 1, borderBottomColor: Colors.BORDER },
  activityLeft:    { flex: 1 },
  emptyActivity:   { padding: Spacing.LG, alignItems: 'center' },
})

const ts = StyleSheet.create<Record<string, TextStyle>>({
  greeting:       { fontSize: FontSize.XL, fontWeight: FontWeight.BOLD, color: Colors.BLACK },
  headerSub:      { fontSize: FontSize.SM, color: Colors.MUTED, marginTop: 2 },
  earningsLabel:  { fontSize: FontSize.SM, color: Colors.MUTED, fontWeight: FontWeight.MEDIUM },
  earningsAmount: { fontSize: FontSize.XXL, fontWeight: FontWeight.BOLD, color: Colors.BLACK, marginTop: 4 },
  earningsSub:    { fontSize: FontSize.SM, color: Colors.MUTED },
  cameraIcon:     { fontSize: 32 },
  cameraLabel:    { fontSize: FontSize.SM, fontWeight: FontWeight.SEMIBOLD, color: Colors.MUTED, marginTop: Spacing.XS },
  statValue:      { fontSize: FontSize.XL, fontWeight: FontWeight.BOLD, color: Colors.BLACK },
  statLabel:      { fontSize: FontSize.XS, color: Colors.MUTED, marginTop: 2, textAlign: 'center' },
  sectionTitle:   { fontSize: FontSize.MD, fontWeight: FontWeight.BOLD, color: Colors.BLACK, marginBottom: Spacing.XS },
  activityLabel:  { fontSize: FontSize.BASE, fontWeight: FontWeight.MEDIUM, color: Colors.BLACK },
  activityTime:   { fontSize: FontSize.XS, color: Colors.MUTED, marginTop: 2 },
  activityAmount: { fontSize: FontSize.BASE, fontWeight: FontWeight.BOLD },
  emptyText:      { fontSize: FontSize.SM, color: Colors.MUTED, textAlign: 'center', lineHeight: 22 },
  refreshHint:    { fontSize: FontSize.XS, color: Colors.BORDER, textAlign: 'center', marginTop: Spacing.LG },
})
