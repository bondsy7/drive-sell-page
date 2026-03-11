import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  CalendarIcon, Clock, Car, Plus, Check, X, Phone, Mail,
  Settings2, Trash2, CalendarDays, User
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Ausstehend', variant: 'outline' },
  confirmed: { label: 'Bestätigt', variant: 'default' },
  completed: { label: 'Abgeschlossen', variant: 'secondary' },
  cancelled: { label: 'Storniert', variant: 'destructive' },
  no_show: { label: 'Nicht erschienen', variant: 'destructive' },
};

interface Booking {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  vehicle_title: string | null;
  booking_date: string;
  booking_time: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  created_at: string;
}

interface Availability {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  slot_duration_minutes: number;
}

export default function SalesBookingsTab() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [blockedDates, setBlockedDates] = useState<{ id: string; blocked_date: string; reason: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const [newBooking, setNewBooking] = useState({ customer_name: '', customer_email: '', customer_phone: '', vehicle_title: '', booking_date: '', booking_time: '10:00', duration_minutes: 30, notes: '' });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [bRes, aRes, bdRes] = await Promise.all([
      supabase.from('test_drive_bookings' as any).select('*').eq('user_id', user.id).order('booking_date', { ascending: true }).order('booking_time', { ascending: true }),
      supabase.from('dealer_availability' as any).select('*').eq('user_id', user.id).order('day_of_week', { ascending: true }),
      supabase.from('dealer_blocked_dates' as any).select('*').eq('user_id', user.id).order('blocked_date', { ascending: true }),
    ]);
    setBookings((bRes.data as any) || []);
    const avail = (aRes.data as any) || [];
    // Fill missing days
    const full: Availability[] = [];
    for (let d = 0; d < 7; d++) {
      const existing = avail.find((a: any) => a.day_of_week === d);
      full.push(existing || { day_of_week: d, start_time: '09:00', end_time: '18:00', is_available: d >= 1 && d <= 5, slot_duration_minutes: 30 });
    }
    setAvailability(full);
    setBlockedDates((bdRes.data as any) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime bookings
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel('bookings-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'test_drive_bookings', filter: `user_id=eq.${user.id}` }, () => loadData()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, loadData]);

  const saveAvailability = async () => {
    if (!user) return;
    setSaving(true);
    for (const a of availability) {
      const row = { user_id: user.id, day_of_week: a.day_of_week, start_time: a.start_time, end_time: a.end_time, is_available: a.is_available, slot_duration_minutes: a.slot_duration_minutes, max_parallel_bookings: 1 };
      if ((a as any).id) {
        await supabase.from('dealer_availability' as any).update(row as any).eq('id', (a as any).id);
      } else {
        await supabase.from('dealer_availability' as any).insert(row as any);
      }
    }
    toast.success('Verfügbarkeit gespeichert');
    setSaving(false);
    loadData();
  };

  const updateBookingStatus = async (id: string, status: string) => {
    await supabase.from('test_drive_bookings' as any).update({ status, updated_at: new Date().toISOString() } as any).eq('id', id);
    toast.success(`Status auf "${STATUS_MAP[status]?.label}" gesetzt`);
    loadData();
  };

  const createBooking = async () => {
    if (!user || !newBooking.customer_name || !newBooking.booking_date || !newBooking.booking_time) return;
    setSaving(true);
    const { error } = await supabase.from('test_drive_bookings' as any).insert({
      user_id: user.id, ...newBooking, status: 'confirmed',
    } as any);
    if (error) { toast.error('Fehler beim Erstellen'); } else { toast.success('Probefahrt erstellt'); setNewBookingOpen(false); setNewBooking({ customer_name: '', customer_email: '', customer_phone: '', vehicle_title: '', booking_date: '', booking_time: '10:00', duration_minutes: 30, notes: '' }); }
    setSaving(false);
    loadData();
  };

  const deleteBooking = async (id: string) => {
    await supabase.from('test_drive_bookings' as any).delete().eq('id', id);
    toast.success('Buchung gelöscht');
    loadData();
  };

  const filteredBookings = selectedDate
    ? bookings.filter(b => b.booking_date === format(selectedDate, 'yyyy-MM-dd'))
    : bookings;

  const upcomingBookings = bookings.filter(b => b.booking_date >= format(new Date(), 'yyyy-MM-dd') && b.status !== 'cancelled');

  const bookedDates = [...new Set(bookings.map(b => b.booking_date))];

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Laden...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Probefahrten</h3>
          <p className="text-sm text-muted-foreground">{upcomingBookings.length} anstehende Termine</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
            <Settings2 className="w-4 h-4 mr-1" /> Verfügbarkeit
          </Button>
          <Dialog open={newBookingOpen} onOpenChange={setNewBookingOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Neue Probefahrt</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Probefahrt erstellen</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Kundenname *</Label><Input value={newBooking.customer_name} onChange={e => setNewBooking(p => ({ ...p, customer_name: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>E-Mail</Label><Input value={newBooking.customer_email} onChange={e => setNewBooking(p => ({ ...p, customer_email: e.target.value }))} /></div>
                  <div><Label>Telefon</Label><Input value={newBooking.customer_phone} onChange={e => setNewBooking(p => ({ ...p, customer_phone: e.target.value }))} /></div>
                </div>
                <div><Label>Fahrzeug</Label><Input value={newBooking.vehicle_title} onChange={e => setNewBooking(p => ({ ...p, vehicle_title: e.target.value }))} placeholder="z.B. BMW 320i" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Datum *</Label><Input type="date" value={newBooking.booking_date} onChange={e => setNewBooking(p => ({ ...p, booking_date: e.target.value }))} /></div>
                  <div><Label>Uhrzeit *</Label><Input type="time" value={newBooking.booking_time} onChange={e => setNewBooking(p => ({ ...p, booking_time: e.target.value }))} /></div>
                </div>
                <div><Label>Dauer (Min.)</Label><Select value={String(newBooking.duration_minutes)} onValueChange={v => setNewBooking(p => ({ ...p, duration_minutes: parseInt(v) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="15">15 Min.</SelectItem><SelectItem value="30">30 Min.</SelectItem><SelectItem value="45">45 Min.</SelectItem><SelectItem value="60">60 Min.</SelectItem></SelectContent></Select></div>
                <div><Label>Notizen</Label><Textarea value={newBooking.notes} onChange={e => setNewBooking(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
                <Button onClick={createBooking} disabled={saving || !newBooking.customer_name || !newBooking.booking_date} className="w-full">Erstellen</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Availability Settings */}
      {showSettings && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Öffnungszeiten & Slot-Dauer</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {availability.map((a, i) => (
              <div key={a.day_of_week} className="flex items-center gap-3 flex-wrap">
                <div className="w-24 text-sm font-medium">{DAY_NAMES[a.day_of_week]}</div>
                <Switch checked={a.is_available} onCheckedChange={v => { const c = [...availability]; c[i] = { ...c[i], is_available: v }; setAvailability(c); }} />
                {a.is_available && (
                  <>
                    <Input type="time" value={a.start_time} className="w-28" onChange={e => { const c = [...availability]; c[i] = { ...c[i], start_time: e.target.value }; setAvailability(c); }} />
                    <span className="text-muted-foreground">–</span>
                    <Input type="time" value={a.end_time} className="w-28" onChange={e => { const c = [...availability]; c[i] = { ...c[i], end_time: e.target.value }; setAvailability(c); }} />
                    <Select value={String(a.slot_duration_minutes)} onValueChange={v => { const c = [...availability]; c[i] = { ...c[i], slot_duration_minutes: parseInt(v) }; setAvailability(c); }}>
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="15">15 Min</SelectItem><SelectItem value="30">30 Min</SelectItem><SelectItem value="45">45 Min</SelectItem><SelectItem value="60">60 Min</SelectItem></SelectContent>
                    </Select>
                  </>
                )}
              </div>
            ))}
            <Button size="sm" onClick={saveAvailability} disabled={saving}>Speichern</Button>
          </CardContent>
        </Card>
      )}

      {/* Calendar + List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardContent className="pt-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className={cn("p-3 pointer-events-auto")}
              modifiers={{ booked: bookedDates.map(d => new Date(d + 'T00:00:00')) }}
              modifiersStyles={{ booked: { fontWeight: 'bold', textDecoration: 'underline' } }}
            />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {selectedDate ? format(selectedDate, 'EEEE, d. MMMM yyyy', { locale: de }) : 'Datum wählen'}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {selectedDate ? `Termine am ${format(selectedDate, 'd. MMM yyyy', { locale: de })}` : 'Alle Termine'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[400px]">
              {filteredBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Keine Termine für diesen Tag</p>
              ) : (
                <div className="space-y-3">
                  {filteredBookings.map(b => (
                    <div key={b.id} className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">{b.booking_time.slice(0, 5)} ({b.duration_minutes} Min.)</span>
                            <Badge variant={STATUS_MAP[b.status]?.variant || 'outline'} className="text-xs">{STATUS_MAP[b.status]?.label || b.status}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm">{b.customer_name}</span>
                          </div>
                          {b.vehicle_title && (
                            <div className="flex items-center gap-2">
                              <Car className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">{b.vehicle_title}</span>
                            </div>
                          )}
                          {b.customer_phone && <div className="flex items-center gap-2"><Phone className="w-3 h-3 text-muted-foreground" /><span className="text-xs text-muted-foreground">{b.customer_phone}</span></div>}
                          {b.customer_email && <div className="flex items-center gap-2"><Mail className="w-3 h-3 text-muted-foreground" /><span className="text-xs text-muted-foreground">{b.customer_email}</span></div>}
                          {b.notes && <p className="text-xs text-muted-foreground italic">{b.notes}</p>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {b.status === 'pending' && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateBookingStatus(b.id, 'confirmed')}><Check className="w-3.5 h-3.5 text-green-600" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateBookingStatus(b.id, 'cancelled')}><X className="w-3.5 h-3.5 text-destructive" /></Button>
                            </>
                          )}
                          {b.status === 'confirmed' && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => updateBookingStatus(b.id, 'completed')}>Erledigt</Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteBooking(b.id)}><Trash2 className="w-3.5 h-3.5 text-muted-foreground" /></Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
