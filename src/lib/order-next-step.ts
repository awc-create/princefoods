// src/lib/order-next-step.ts
/**
 * Works out what a staff member should do next with an order.
 *
 * This is the single source of truth for the "Next step" bar. It exists because
 * the admin has four actions that all sound like "send the order" (buy label,
 * mark fulfilled, add tracking, dispatch) and nothing previously told staff
 * which one to press, or in what order.
 *
 * The real sequence is:
 *   paid -> pick & pack -> buy label -> print label -> notify customer -> done
 */

export type NextStepTone = 'action' | 'waiting' | 'done' | 'problem';

export interface NextStepAction {
  label: string;
  /** Opens in a new tab (print views). */
  href?: string;
  newTab?: boolean;
  /** Client-side action key handled by the bar component. */
  action?: 'buy-label' | 'notify-customer' | 'undo-cancel';
}

export interface NextStep {
  tone: NextStepTone;
  /** Short "where we are" line. */
  title: string;
  /** What to do, in plain English. */
  detail: string;
  primary?: NextStepAction;
  secondary?: NextStepAction;
}

export interface OrderStateInput {
  orderId: string;
  status: string;
  paymentStatus: string;
  archivedAt?: Date | string | null;
  /** Reversal window for a cancellation, if still open. */
  cancelReversibleUntil?: Date | string | null;
  refundTotal?: number | null;
  /** Newest non-voided shipment, if any. */
  shipment?: {
    status: string;
    hasLabel: boolean;
    dispatchedAt?: Date | string | null;
    trackingNumber?: string | null;
    voidedAt?: Date | string | null;
  } | null;
}

const isSet = (v: unknown) => v !== null && v !== undefined && v !== '';

export function getOrderNextStep(o: OrderStateInput): NextStep {
  const printLabel: NextStepAction = {
    label: 'Print label',
    href: `/api/admin/orders/${o.orderId}/labels/latest`,
    newTab: true
  };
  const printPicking: NextStepAction = {
    label: 'Print picking list',
    href: `/api/admin/orders/${o.orderId}/print-order`,
    newTab: true
  };

  /* ---- cancelled / refunded ---- */
  if (o.status === 'CANCELLED' || o.status === 'REFUNDED') {
    const until = o.cancelReversibleUntil ? new Date(o.cancelReversibleUntil) : null;
    const canUndo = Boolean(until && until.getTime() > Date.now()) && (o.refundTotal ?? 0) === 0;

    return {
      tone: 'done',
      title: o.status === 'REFUNDED' ? 'This order was refunded' : 'This order was cancelled',
      detail: canUndo
        ? 'Nothing to pack. You can still undo this if it was a mistake.'
        : 'Nothing to pack or send.',
      primary: canUndo ? { label: 'Undo cancellation', action: 'undo-cancel' } : undefined
    };
  }

  /* ---- not paid yet ---- */
  if (o.status === 'DRAFT' || o.status === 'PLACED' || o.paymentStatus === 'PENDING') {
    return {
      tone: 'waiting',
      title: 'Waiting for payment',
      detail: "Don't pack this yet. It will move to “Paid — ready to pack” once the payment clears."
    };
  }

  if (o.paymentStatus === 'FAILED') {
    return {
      tone: 'problem',
      title: 'Payment failed',
      detail: "Don't pack this. The customer needs to pay again before it can be sent."
    };
  }

  const shipment = o.shipment && !isSet(o.shipment.voidedAt) ? o.shipment : null;

  /* ---- paid, no shipment yet ---- */
  if (!shipment) {
    return {
      tone: 'action',
      title: 'Ready to pack',
      detail:
        'Print the picking list, gather the items, then buy a shipping label when the parcel is ready.',
      primary: printPicking,
      secondary: { label: 'Buy shipping label', action: 'buy-label' }
    };
  }

  /* ---- shipment exists but label not ready ---- */
  if (!shipment.hasLabel) {
    const failed = shipment.status === 'CANCELLED';
    if (failed) {
      return {
        tone: 'problem',
        title: 'Label could not be bought',
        detail: 'Check the delivery address and weight, then try buying the label again.',
        primary: { label: 'Try again', action: 'buy-label' }
      };
    }
    return {
      tone: 'waiting',
      title: 'Getting the label from APC',
      detail: 'This usually takes a few seconds. The label appears here when it is ready.'
    };
  }

  /* ---- label ready, customer not told yet ---- */
  if (!isSet(shipment.dispatchedAt)) {
    return {
      tone: 'action',
      title: 'Label ready to print',
      detail:
        'Print the label and stick it on the parcel. Then let the customer know it is on the way — that also sends their tracking link.',
      primary: printLabel,
      secondary: { label: 'Email tracking to customer', action: 'notify-customer' }
    };
  }

  /* ---- dispatched ---- */
  if (shipment.status === 'DELIVERED') {
    return {
      tone: 'done',
      title: 'Delivered',
      detail: 'Nothing to do. The customer has their parcel.'
    };
  }

  return {
    tone: 'done',
    title: 'On its way to the customer',
    detail: shipment.trackingNumber
      ? `Tracking ${shipment.trackingNumber} has been emailed to the customer. Nothing to do unless there is a delivery problem.`
      : 'The customer has been emailed. Nothing to do unless there is a delivery problem.'
  };
}
