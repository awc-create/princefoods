import { NextResponse } from 'next/server';

const HEADERS = [
  'handleId','fieldType','name','description','productImageUrl','collection',
  'sku','ribbon','price','surcharge','visible','discountMode','discountValue',
  'inventory','weight','cost',
  'productOptionName1','productOptionType1','productOptionDescription1',
  'productOptionName2','productOptionType2','productOptionDescription2',
  'productOptionName3','productOptionType3','productOptionDescription3',
  'productOptionName4','productOptionType4','productOptionDescription4',
  'productOptionName5','productOptionType5','productOptionDescription5',
  'productOptionName6','productOptionType6','productOptionDescription6',
  'additionalInfoTitle1','additionalInfoDescription1',
  'additionalInfoTitle2','additionalInfoDescription2',
  'additionalInfoTitle3','additionalInfoDescription3',
  'additionalInfoTitle4','additionalInfoDescription4',
  'additionalInfoTitle5','additionalInfoDescription5',
  'additionalInfoTitle6','additionalInfoDescription6',
  'customTextField1','customTextCharLimit1','customTextMandatory1',
  'customTextField2','customTextCharLimit2','customTextMandatory2',
  'brand'
];

export async function GET() {
  const csv = HEADERS.join(',') + '\n';
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="products_template_wix.csv"',
    },
  });
}
