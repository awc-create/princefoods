// src/lib/shipping/apc-serviceAvailability.ts
import { apcFetch } from '@/lib/shipping/apc-client';

export interface ApcService {
  Carrier: string;
  ServiceName: string;
  ProductCode: string;
  MinTransitDays?: string;
  MaxTransitDays?: string;
  TotalCost?: string;
  Currency?: string;
  ItemType?: string;
}

interface ServiceAvailabilityResponse {
  ServiceAvailability: {
    Messages: { Code: string; Description: string };
    Services?: { Service?: ApcService[] | ApcService };
  };
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export async function getApcServices(params: {
  collectionPostcode: string;
  deliveryPostcode: string;
  collectionDate: string; // DD/MM/YYYY
  readyAt: string; // HH:MM
  closedAt: string; // HH:MM
  weightKg: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  type?: 'ALL' | 'PACK' | 'PARCEL' | 'PALLET' | 'LIQUIDS' | 'LIMITED QUANTITIES';
}): Promise<ApcService[]> {
  const body = {
    Orders: {
      Order: {
        CollectionDate: params.collectionDate,
        ReadyAt: params.readyAt,
        ClosedAt: params.closedAt,
        Collection: { PostalCode: params.collectionPostcode, CountryCode: 'GB' },
        Delivery: { PostalCode: params.deliveryPostcode, CountryCode: 'GB' },
        GoodsInfo: { GoodsValue: '1', Fragile: 'False' },
        ShipmentDetails: {
          NumberOfPieces: '1',
          Items: {
            Item: {
              // ✅ eslint: prefer ?? over ||
              Type: params.type ?? 'ALL',
              Weight: String(params.weightKg),
              Length: String(params.lengthCm ?? 0),
              Width: String(params.widthCm ?? 0),
              Height: String(params.heightCm ?? 0),
              Value: '1'
            }
          }
        }
      }
    }
  };

  const res = await apcFetch<ServiceAvailabilityResponse>('/ServiceAvailability.json', {
    method: 'POST',
    body: JSON.stringify(body)
  });

  const svc = res.ServiceAvailability?.Services?.Service;
  return asArray(svc).filter((s) => Boolean(s?.ProductCode));
}
