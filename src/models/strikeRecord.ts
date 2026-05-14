export class StrikeRecord {
    reference: string;
    dateTimeUtc: Date;
    transactionType: string;
    amountEur: number;
    feeEur: number;
    amountBtc: number;
    feeBtc: number;
    btcPrice: number;
    costBasisEur: number;
    destination: string;
    description: string;
    transactionHash: string;
    note: string;
}
