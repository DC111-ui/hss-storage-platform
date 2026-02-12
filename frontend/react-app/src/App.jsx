import { useCallback, useEffect, useState } from 'react';
import BookingForm from './components/BookingForm';
import BookingList from './components/BookingList';

const defaultApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function App() {
  const [apiUrl] = useState(defaultApiUrl);
  const [bookings, setBookings] = useState([]);
  const [health, setHealth] = useState('loading');

  const loadBookings = useCallback(async () => {
    const response = await fetch(`${apiUrl}/api/bookings`);
    const data = await response.json();
    setBookings(data.bookings ?? []);
  }, [apiUrl]);

  useEffect(() => {
    fetch(`${apiUrl}/health`)
      .then((response) => response.json())
      .then(() => setHealth('online'))
      .catch(() => setHealth('offline'));

    loadBookings().catch(() => setBookings([]));
  }, [apiUrl, loadBookings]);

  return (
    <main className="container">
      <header>
        <h1>Hatfield Storage Solutions</h1>
        <p>Modernized with React + Node.js + AWS CDK</p>
        <p>
          API status: <span className={`status ${health}`}>{health}</span>
        </p>
      </header>

      <section>
        <h2>Create a booking</h2>
        <BookingForm apiUrl={apiUrl} onCreated={loadBookings} />
      </section>

      <section>
        <h2>Recent bookings</h2>
        <BookingList bookings={bookings} />
      </section>
    </main>
  );
}
