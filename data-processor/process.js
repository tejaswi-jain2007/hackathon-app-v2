const fs = require('fs');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');

// You can change 'input.csv' to whatever your file name is
const INPUT_FILE = '../IIST Internal Hackathon 2026 (Responses) (1).xlsx'; 

async function processData() {
    console.log(`Reading file: ${INPUT_FILE}...`);

    try {
        // 1. Read File
        const workbook = XLSX.readFile(INPUT_FILE);
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        console.log(`Total rows found: ${data.length}`);

        // 2. Remove Duplicates
        const uniqueData = [];
        const seenTeams = new Set();

        // Loop backwards so we keep the LATEST submission (in case they resubmitted to fix errors)
        for (let i = data.length - 1; i >= 0; i--) {
            const row = data[i];
            
            // Use Leader Email as the primary unique identifier
            let leaderEmail = row["TEAM LEADER'S mail id"] ? String(row["TEAM LEADER'S mail id"]).trim().toLowerCase() : '';
            let submitterEmail = row["Email Address"] ? String(row["Email Address"]).trim().toLowerCase() : '';
            let teamName = row['TEAM NAME'] ? String(row['TEAM NAME']).trim().toLowerCase().replace(/\s+/g, ' ') : '';

            // If leader email is missing, fallback to submitter email + team name
            let key = leaderEmail || (submitterEmail + '-' + teamName) || JSON.stringify(row);

            if (!seenTeams.has(key)) {
                seenTeams.add(key);
                uniqueData.unshift(row);
            }
        }

        console.log(`Unique rows after deduplication: ${uniqueData.length}`);
        console.log(`Duplicates removed: ${data.length - uniqueData.length}`);

        // 3. Calculate Statistics
        let yearCounts = { '1st Year': 0, '2nd Year': 0, '3rd Year': 0, '4th Year': 0 };
        let domainCounts = {};

        function detectYear(val) {
            if (!val) return null;
            const str = String(val).toLowerCase().trim();
            if (str.includes('1st') || str.includes('first') || str === '1' || str === 'i') return '1st Year';
            if (str.includes('2nd') || str.includes('second') || str === '2' || str === 'ii') return '2nd Year';
            if (str.includes('3rd') || str.includes('third') || str === '3' || str === 'iii') return '3rd Year';
            if (str.includes('4th') || str.includes('fourth') || str === '4' || str === 'iv') return '4th Year';
            return null;
        }

        uniqueData.forEach(row => {
            // Find Year for ALL members
            for (const [key, value] of Object.entries(row)) {
                if (key.toLowerCase().includes('year') || key.toLowerCase().includes('semester') || key.toLowerCase().includes('course')) {
                    const year = detectYear(value);
                    if (year) { yearCounts[year]++; }
                }
            }
            
            // Find Domain / Theme
            for (const [key, value] of Object.entries(row)) {
                if (key.toLowerCase().includes('domain') || key.toLowerCase().includes('theme') || key.toLowerCase().includes('track')) {
                    const domain = String(value).trim();
                    domainCounts[domain] = (domainCounts[domain] || 0) + 1;
                    break;
                }
            }
        });

        // 4. Create new formatted Excel sheet using ExcelJS
        console.log(`Generating Cleaned Excel Sheet with proper formatting...`);
        const workbookJS = new ExcelJS.Workbook();
        const sheet = workbookJS.addWorksheet("Cleaned Data", {
            views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
        });

        if (uniqueData.length > 0) {
            const headers = Object.keys(uniqueData[0]);
            sheet.columns = headers.map(header => ({
                header: header,
                key: header,
                width: 20
            }));

            // Add the rows
            sheet.addRows(uniqueData);

            // Style Header Row
            const headerRow = sheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // White text
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4F81BD' } // Blue background
            };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

            // Apply styling to all columns and cells
            sheet.columns.forEach(column => {
                let maxLength = column.header ? column.header.length : 10;
                column.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
                    const cellLength = cell.value ? cell.value.toString().length : 10;
                    if (cellLength > maxLength) {
                        maxLength = cellLength;
                    }
                    
                    // Add borders to every cell
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    
                    if (rowNumber > 1) {
                        cell.alignment = { vertical: 'middle', wrapText: true };
                    }
                });
                
                // Limit max width to prevent extremely wide columns
                column.width = maxLength < 45 ? maxLength + 2 : 45; 
            });
        }

        await workbookJS.xlsx.writeFile("Cleaned_Teams_Formatted.xlsx");

        // 5. Generate Word Document (.docx)
        console.log(`Generating Word Document...`);
        const docx = require('docx');
        const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;

        const children = [
            new Paragraph({ text: "HACKATHON REGISTRATION REPORT", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: "=============================\n" }),
            new Paragraph({ text: `Total Entries (Before Deduplication): ${data.length}` }),
            new Paragraph({ text: `Total Unique Teams: ${uniqueData.length}` }),
            new Paragraph({ text: `Duplicates Removed: ${data.length - uniqueData.length}\n` }),
            new Paragraph({ text: "--- Year-wise Breakdown (All Team Members) ---", heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: `1st Year (I): ${yearCounts['1st Year']} students` }),
            new Paragraph({ text: `2nd Year (II): ${yearCounts['2nd Year']} students` }),
            new Paragraph({ text: `3rd Year (III): ${yearCounts['3rd Year']} students` }),
            new Paragraph({ text: `4th Year (IV): ${yearCounts['4th Year']} students\n` }),
            new Paragraph({ text: "--- Domain-wise Teams ---", heading: HeadingLevel.HEADING_2 }),
        ];

        if (Object.keys(domainCounts).length === 0) {
            children.push(new Paragraph({ text: "No 'Domain/Theme/Track' column found in the CSV." }));
        } else {
            const sortedDomains = Object.keys(domainCounts).sort();
            for (const domain of sortedDomains) {
                children.push(new Paragraph({ text: `${domain}: ${domainCounts[domain]} teams` }));
            }
        }

        const doc = new Document({
            sections: [{ properties: {}, children: children }],
        });

        const buffer = await Packer.toBuffer(doc);
        fs.writeFileSync("Report.docx", buffer);

        console.log("------------------------------------------");
        console.log("SUCCESS! ✅");
        console.log("1. Check 'Cleaned_Teams_Formatted.xlsx' for the beautifully formatted Excel sheet.");
        console.log("2. Check 'Report.docx' for the Word Document report.");
        console.log("------------------------------------------");

    } catch (err) {
        console.error("Error occurred while processing:", err.message);
        if (err.message.includes('EBUSY')) {
            console.error("👉 Please CLOSE the Excel file if it's open, then run again!");
        }
    }
}

processData();
