'use client';

import { useEffect, useState } from 'react';

export default function AvailabilityForm({ params }: { params: { token: string } }) {
  const [member, setMember] = useState<{ id: string; name: string } | null>(null);
  const [availability, setAvailability] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/availability/${params.token}`)
      .then(res => res.json())
      .then(data => {
        setMember(data.member);
        setAvailability(data.availability || {});
        setLoading(false);
      });
  }, [params.token]);

  const handleChange = (day: string) => {
    setAvailability((prev: any) => ({
      ...prev,
      [day]: !prev[day],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`/api/availability/${params.token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ availability }),
    });
    setSubmitted(true);
  };

  if (loading) return <div>Loading...</div>;
  if (!member) return <div>Invalid or expired link.</div>;
  if (submitted) return <div>Thank you for submitting your availability!</div>;

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  return (
    <div>
      <h2>Hello, {member.name}! Please select your availability:</h2>
      <form onSubmit={handleSubmit}>
        {days.map(day => (
          <div key={day}>
            <label>
              <input
                type="checkbox"
                checked={!!availability[day]}
                onChange={() => handleChange(day)}
              />
              {day}
            </label>
          </div>
        ))}
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}