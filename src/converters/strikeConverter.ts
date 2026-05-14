import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { parse } from "csv-parse";
import { AbstractConverter } from "./abstractconverter";
import { SecurityService } from "../securityService";
import { GhostfolioExport } from "../models/ghostfolioExport";
import { StrikeRecord } from "../models/strikeRecord";
import { GhostfolioOrderType } from "../models/ghostfolioOrderType";
import { getTags } from "../helpers/tagHelpers";

dayjs.extend(customParseFormat);

export class StrikeConverter extends AbstractConverter {

    constructor(securityService: SecurityService) {
        super(securityService);
    }

    /**
     * @inheritdoc
     */
    protected processHeaders(_: string): string[] {
        return [
            "reference",
            "dateTimeUtc",
            "transactionType",
            "amountEur",
            "feeEur",
            "amountBtc",
            "feeBtc",
            "btcPrice",
            "costBasisEur",
            "destination",
            "description",
            "transactionHash",
            "note"
        ];
    }

    /**
     * @inheritdoc
     */
    public processFileContents(input: string, successCallback: any, errorCallback: any): void {

        // Parse the CSV and convert to Ghostfolio import format.
        parse(input, {
            delimiter: ",",
            fromLine: 2,
            columns: this.processHeaders(input),
            cast: (columnValue, context) => {

                // Custom mapping below.

                // Convert transaction types to Ghostfolio type.
                if (context.column === "transactionType") {
                    const type = columnValue.toLocaleLowerCase();

                    if (type === "purchase") {
                        return "buy";
                    }
                    else if (type === "sell") {
                        return "sell";
                    }
                }

                // Parse numbers to floats (from string).
                if (context.column === "amountEur" ||
                    context.column === "feeEur" ||
                    context.column === "amountBtc" ||
                    context.column === "feeBtc" ||
                    context.column === "btcPrice" ||
                    context.column === "costBasisEur") {

                    if (columnValue === "") {
                        return 0;
                    }

                    return parseFloat(columnValue);
                }

                return columnValue;
            }
        }, async (err, records: StrikeRecord[]) => {

            try {

                // Check if parsing failed...
                if (err || records === undefined || records.length === 0) {
                    let errorMsg = "An error occurred while parsing!";

                    if (err) {
                        errorMsg += ` Details: ${err.message}`
                    }

                    return errorCallback(new Error(errorMsg))
                }

                console.log("[i] Read CSV file. Start processing..");
                const result: GhostfolioExport = {
                    meta: {
                        date: new Date(),
                        version: "v0"
                    },
                    activities: []
                }

                // Populate the progress bar.
                const bar1 = this.progress.create(records.length, 0);

                for (let idx = 0; idx < records.length; idx++) {
                    const record = records[idx];

                    // Check if the record should be ignored.
                    if (this.isIgnoredRecord(record)) {
                        bar1.increment();
                        continue;
                    }

                    const symbol = "BTC-EUR";
                    const fee = record.feeEur || 0;
                    const date = dayjs(`${record.dateTimeUtc}`, "MMM DD YYYY HH:mm:ss");

                    // Add record to export.
                    result.activities.push({
                        accountId: process.env.GHOSTFOLIO_ACCOUNT_ID,
                        comment: null,
                        fee: fee,
                        quantity: Math.abs(record.amountBtc),
                        type: GhostfolioOrderType[record.transactionType],
                        unitPrice: record.btcPrice,
                        currency: "EUR",
                        dataSource: "YAHOO",
                        date: date.format("YYYY-MM-DDTHH:mm:ssZ"),
                        symbol: symbol,
                        tags: getTags()
                    });

                    bar1.increment();
                }

                this.progress.stop();

                successCallback(result);
            }
            catch (error) {
                console.log("[e] An error occurred while processing the file contents. Stack trace:");
                console.log(error.stack);
                this.progress.stop();
                errorCallback(error);
            }
        });
    }

    /**
     * @inheritdoc
     */
    public isIgnoredRecord(record: StrikeRecord): boolean {
        return ["deposit", "receive", "send"].some(
            (t) => record.transactionType.toLocaleLowerCase().indexOf(t) > -1
        );
    }
}
