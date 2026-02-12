import { useState } from 'react';

export default function BookingForm({ apiUrl, onCreated }) {
  const [customerName, setCustomerName] = useState('');
  const [unitSize, setUnitSize] = useState('Small');
  const [message, setMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();

    const response = await fetch(`${apiUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName, unitSize })
    });

    if (!response.ok) {
      setMessage('Could not create booking.');
      return;
    }

    setMessage('Booking created successfully.');
    setCustomerName('');
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="booking-form">
      <label>
        Customer name
        <input
          value={customerName}
          onChange={(event) => setCustomerName(event.target.value)}
          required
        />
      </label>

      <label>
        Unit size
        <select value={unitSize} onChange={(event) => setUnitSize(event.target.value)}>
          <option>Small</option>
          <option>Medium</option>
          <option>Large</option>
        </select>
      </label>

      <button type="submit">Create booking</button>
      {message && <p>{message}</p>}
    </form>
  );
}
