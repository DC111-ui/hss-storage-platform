export default function BookingList({ bookings }) {
  if (!bookings.length) {
    return <p>No bookings yet.</p>;
  }

  return (
    <ul className="booking-list">
      {bookings.map((booking) => (
        <li key={booking.id}>
          <strong>{booking.customerName}</strong> - {booking.unitSize} - {booking.status}
        </li>
      ))}
    </ul>
  );
}
