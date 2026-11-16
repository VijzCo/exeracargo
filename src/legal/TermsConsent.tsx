// Booking terms consent for customers (not signed in): the existing "I understand / accept" checkbox on the
// booking forms links the documents, and the booking stores the accepted versions + time.
import { legalDoc } from './docs';

/** Version string stored on the booking: "<booking terms version>+<privacy version>". */
export function bookingTermsVersion(tenant: Parameters<typeof legalDoc>[1]): string {
  return `${legalDoc('booking', tenant).version}+${legalDoc('privacy', tenant).version}`;
}

export function BookingTermsLinks() {
  return (
    <>
      <a href="/legal/booking-terms" target="_blank" rel="noopener">
        Booking Terms
      </a>{' '}
      and{' '}
      <a href="/legal/privacy" target="_blank" rel="noopener">
        Privacy Notice
      </a>
    </>
  );
}
