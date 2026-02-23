'use client';

import { useEffect, useState } from 'react';

type Role = { id: number; name: string };

export default function AvailabilityForm({
  params,
}: {
  params: { token: string };
}) {
  const [member, setMember] = useState<{ id: string; name: string } | null>(
    null
  );
  const [sundays, setSundays] = useState<string[]>([]);
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [roles, setRoles] = useState<Role[]>([]);
  const [preferredRole, setPreferredRole] = useState<number | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [lockout, setLockout] = useState<{ locked: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  // Compute next month YYYY-MM-01
  function getTargetMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
    return `${next.y}-${String(next.m).padStart(2, '0')}-01`;
  }

  const targetMonth = getTargetMonth();

  useEffect(() => {
    fetch(`/api/availability/${params.token}?targetMonth=${targetMonth}`)
      .then(res => res.json())
      .then(data => {
        if (!data.member) {
          setMember(null);
          setLoading(false);
          return;
        }

        setMember(data.member);
        setSundays(data.sundays || []);
        setRoles(data.roles || []);
        setLockout(data.lockout || null);

        const existing = new Set<string>();
        (data.availability || []).forEach((row: { status: string; date: string }) => {
          if (row.status === 'AVAILABLE') {
            existing.add(row.date);
          }
        });

        setAvailableDates(existing);
        setLoading(false);
      });
  }, [params.token, targetMonth]);

  function toggleDate(date: string) {
    setAvailableDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    await fetch(`/api/availability/${params.token}?targetMonth=${targetMonth}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preferred_role_id: preferredRole,
        notes,
        available_dates: Array.from(availableDates),
      }),
    });

    setSubmitted(true);
  }

  if (loading) return <div>Loading...</div>;
  if (!member) return <div>Invalid or expired link.</div>;
  if (submitted) return <div>Thank you for submitting your availability!</div>;

  if (lockout?.locked) {
    return (
      <div>
        <h2>Hello {member.name}</h2>
        <p>Availability is locked for this month.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Hello, {member.name}!</h2>
      <p>Please select your availability for next month.</p>

      <form onSubmit={handleSubmit}>
        <h3>Sundays</h3>
        {sundays.map(date => (
          <div key={date}>
            <label>
              <input
                type="checkbox"
                checked={availableDates.has(date)}
                onChange={() => toggleDate(date)}
              />
              {date}
            </label>
          </div>
        ))}

        <h3>Preferred Role</h3>
        <select
          value={preferredRole ?? ''}
          onChange={e =>
            setPreferredRole(
              e.target.value ? Number(e.target.value) : null
            )
          }
        >
          <option value="">Select role</option>
          {roles.map(role => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>

        <h3>Notes</h3>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />

        <br />
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}