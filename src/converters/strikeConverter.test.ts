import { StrikeConverter } from "./strikeConverter";
import { SecurityService } from "../securityService";
import { GhostfolioExport } from "../models/ghostfolioExport";
import YahooFinanceServiceMock from "../testing/yahooFinanceServiceMock";

describe("strikeConverter", () => {

  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should construct", () => {

    // Act
    const sut = new StrikeConverter(new SecurityService(new YahooFinanceServiceMock()));

    // Assert
    expect(sut).toBeTruthy();
  });

  it("should process sample CSV file", (done) => {

    // Arrange
    const sut = new StrikeConverter(new SecurityService(new YahooFinanceServiceMock()));
    const inputFile = "samples/strike-export.csv";

    // Act
    sut.readAndProcessFile(inputFile, (actualExport: GhostfolioExport) => {

      // Assert
      expect(actualExport).toBeTruthy();
      expect(actualExport.activities.length).toBeGreaterThan(0);
      expect(actualExport.activities.length).toBe(3);

      done();
    }, () => { done.fail("Should not have an error!"); });
  });

  describe("should throw an error if", () => {
    it("the input file does not exist", (done) => {

      // Arrange
      const sut = new StrikeConverter(new SecurityService(new YahooFinanceServiceMock()));

      let tempFileName = "tmp/testinput/strike-filedoesnotexist.csv";

      // Act
      sut.readAndProcessFile(tempFileName, () => { done.fail("Should not succeed!"); }, (err: Error) => {

        // Assert
        expect(err).toBeTruthy();

        done();
      });
    });

    it("the input file is empty", (done) => {

      // Arrange
      const sut = new StrikeConverter(new SecurityService(new YahooFinanceServiceMock()));

      let tempFileContent = "";
      tempFileContent += `Reference,Date & Time (UTC),Transaction Type,Amount EUR,Fee EUR,Amount BTC,Fee BTC,BTC Price,Cost Basis (EUR),Destination,Description,Transaction Hash,Note\n`;

      // Act
      sut.processFileContents(tempFileContent, () => { done.fail("Should not succeed!"); }, (err: Error) => {

        // Assert
        expect(err).toBeTruthy();
        expect(err.message).toContain("An error occurred while parsing");

        done();
      });
    });

    it("the header and row column count doesn't match", (done) => {

      // Arrange
      const sut = new StrikeConverter(new SecurityService(new YahooFinanceServiceMock()));

      let tempFileContent = "";
      tempFileContent += `Reference,Date & Time (UTC),Transaction Type,Amount EUR,Fee EUR,Amount BTC,Fee BTC,BTC Price,Cost Basis (EUR),Destination,Description,Transaction Hash,Note\n`;
      tempFileContent += `TXN-001,Jan 15 2025 09:30:22,Purchase,-50.0,,0.00053814,,92912.45,50.0,,,,,,`;

      // Act
      sut.processFileContents(tempFileContent, () => { done.fail("Should not succeed!"); }, (err: Error) => {

        // Assert
        expect(err).toBeTruthy();
        expect(err.message).toContain("Invalid Record Length");

        done();
      });
    });
  });

  it("should process purchase transactions correctly", (done) => {

    // Arrange
    let tempFileContent = "";
    tempFileContent += `Reference,Date & Time (UTC),Transaction Type,Amount EUR,Fee EUR,Amount BTC,Fee BTC,BTC Price,Cost Basis (EUR),Destination,Description,Transaction Hash,Note\n`;
    tempFileContent += `TXN-001,Jan 15 2025 09:30:22,Purchase,-50.0,,0.00053814,,92912.45,50.0,,,,\n`;
    tempFileContent += `TXN-002,Jan 16 2025 09:30:10,Purchase,-100.0,,0.00107294,,93204.63,100.0,,,,`;

    const sut = new StrikeConverter(new SecurityService(new YahooFinanceServiceMock()));

    // Act
    sut.processFileContents(tempFileContent, (actualExport: GhostfolioExport) => {

      // Assert
      expect(actualExport).toBeTruthy();
      expect(actualExport.activities.length).toBe(2);

      // Check first purchase
      expect(actualExport.activities[0].type).toBe("BUY");
      expect(actualExport.activities[0].quantity).toBe(0.00053814);
      expect(actualExport.activities[0].unitPrice).toBe(92912.45);
      expect(actualExport.activities[0].fee).toBe(0);
      expect(actualExport.activities[0].currency).toBe("EUR");
      expect(actualExport.activities[0].symbol).toBe("BTC-EUR");

      // Check second purchase
      expect(actualExport.activities[1].type).toBe("BUY");
      expect(actualExport.activities[1].quantity).toBe(0.00107294);
      expect(actualExport.activities[1].unitPrice).toBe(93204.63);

      done();
    }, () => done.fail("Should not have an error!"));
  });

  it("should ignore deposit, receive, and send records", (done) => {

    // Arrange
    let tempFileContent = "";
    tempFileContent += `Reference,Date & Time (UTC),Transaction Type,Amount EUR,Fee EUR,Amount BTC,Fee BTC,BTC Price,Cost Basis (EUR),Destination,Description,Transaction Hash,Note\n`;
    tempFileContent += `TXN-001,Jan 15 2025 09:30:22,Purchase,-50.0,,0.00053814,,92912.45,50.0,,,,\n`;
    tempFileContent += `TXN-002,Jan 17 2025 14:20:05,Receive,,,0.00045000,,,,bc1qXXXX,,a1b2c3d4,\n`;
    tempFileContent += `TXN-003,Jan 18 2025 12:00:00,Deposit,500.0,,,,,,,,,\n`;
    tempFileContent += `TXN-004,Jan 20 2025 16:45:30,Send,,,-0.00200000,,,,bc1qXXXX,,f0e1d2c3,`;

    const sut = new StrikeConverter(new SecurityService(new YahooFinanceServiceMock()));

    // Act
    sut.processFileContents(tempFileContent, (actualExport: GhostfolioExport) => {

      // Assert
      expect(actualExport).toBeTruthy();
      expect(actualExport.activities.length).toBe(1);
      expect(actualExport.activities[0].type).toBe("BUY");

      done();
    }, () => done.fail("Should not have an error!"));
  });

  it("should log error and invoke errorCallback when an error occurs in processFileContents", (done) => {

    // Arrange
    const tempFileContent = "Invalid CSV content";
    const sut = new StrikeConverter(new SecurityService(new YahooFinanceServiceMock()));

    const consoleSpy = jest.spyOn(console, "log");

    // Act
    sut.processFileContents(tempFileContent, () => {
      done.fail("Should not succeed!");
    }, (err: Error) => {

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith("[e] An error occurred while processing the file contents. Stack trace:");
      expect(consoleSpy).toHaveBeenCalledWith(err.stack);
      expect(err).toBeTruthy();

      done();
    });
  });
});
