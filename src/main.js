import './style.css'

const queryInput = document.getElementById('query-input')
const generateBtn = document.getElementById('generate-btn')
const btnText = generateBtn.querySelector('.btn-text')
const btnLoader = document.getElementById('btn-loader')
const resultContainer = document.getElementById('result-container')
const testCaseOutput = document.getElementById('test-case-output')
const copyBtn = document.getElementById('copy-btn')
const exportCsvBtn = document.getElementById('export-csv-btn')
const fileInput = document.getElementById('file-input')
const fileUploadText = document.getElementById('file-upload-text')
const fileContentPreview = document.getElementById('file-content-preview')

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY

let attachedFileContent = null;
let attachedFileName = null;
let lastGeneratedResult = '';

async function generateTestCase(query) {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `You are a Senior QA Architect with 15+ years of experience in enterprise software testing. You write test cases that look like they were authored by a domain expert who deeply understands the application.

Your task is to generate comprehensive manual test cases based on:
1. User query or feature description
2. Attached PRD / User Manual / Functional document

Step 1: Carefully read and analyze the entire document.

Step 2: Identify all modules, functionalities, forms, workflows, user roles, validations, and system restrictions.

Step 3: Cover all testing areas:
- Functional flows (happy path)
- Negative scenarios (invalid data, wrong sequence)
- Boundary value cases (max/min limits)
- UI validation (field labels, error messages, buttons)
- Data validation (required fields, formats, duplicates)
- Role-based access control
- Error handling and recovery
- Edge cases

Step 4: Generate at least 15-20 detailed test cases per major functionality.

IMPORTANT - SCENARIO DESCRIPTION RULES:
- Must start with "Verify "
- Must be specific and domain-aware
- Good examples:
  "Verify that assigning a faculty already set as anchor shows a warning"
  "Verify login with correct credentials redirects to admin dashboard"
  "Verify program anchor dropdown shows only active faculties"
  "Verify that saving without selecting a course anchor shows validation error"
  "Verify that anchor assignment is reflected immediately in the Anchor Report tab"
- Bad examples (too generic): "Verify login", "Check submit button", "Test form"

IMPORTANT - STEPS TO EXECUTE RULES:
- Must be granular, numbered, and actionable
- Each step describes one specific action
- Use pipe symbol "|" to separate multiple steps on the same row
- Example: "1. Login as admin at https://lms.svkm.ac.in | 2. Click on Anchor Assignment tab | 3. Select a faculty from the Program Anchor dropdown | 4. Click Save"

IMPORTANT - EXPECTED RESULT RULES:
- Must describe specific UI feedback
- Example: "System displays validation toast: 'This faculty is already assigned as an anchor' | Save button remains disabled | No duplicate assignment is created in the database"

Column structure (STRICT CSV):
Scenario TID,Type (Positive/Negative),Scenario Description,Test Case ID,Pre-Condition,Steps to Execute,Expected Result,Actual Result,Status (Pass/Fail),Executed QA Name,Comments

Rules:
1. Scenario TID: group identifier (SCN-01, SCN-02)
2. Test Case ID: unique per test case (TC-001, TC-002)
3. Steps to Execute: pipe-separated numbered steps
4. Expected Result: specific system behavior with UI feedback
5. Actual Result: LEAVE EMPTY
6. Status (Pass/Fail): LEAVE EMPTY
7. Comments: LEAVE EMPTY
8. Executed QA Name: always "Maruf"
9. Avoid duplicates. Cover all scenarios thoroughly.
10. Each row must be a single line. Use pipe "|" for multi-value fields. No commas inside cell values.

Strict Rule: Output ONLY the CSV table starting with the header row. No notes, no explanations.`
          },
          {
            role: 'user',
            content: `User Requirements and Context:
"${query}"

Generate the test cases adhering strictly to the Senior QA Architect standards and the required CSV format.`
          }
        ],
        temperature: 0,
        max_tokens: 8000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to generate test cases');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling Groq API:', error);
    throw error;
  }
}

function formatMarkdown(content) {
  const trimmed = content.trim();

  // ---- PRE-PROCESS: Rejoin lines that are continuation of a previous CSV row ----
  // ONLY merge lines with ZERO commas (pure step continuations like "2. Enter password")
  // Lines with ANY comma likely contain column data and must stay as separate rows.
  const rawLines = trimmed.split('\n');
  const mergedLines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;
    const commaCount = (line.match(/,/g) || []).length;
    // Only lines with NO commas are safe to merge as step continuations
    if (commaCount === 0 && mergedLines.length > 0) {
      mergedLines[mergedLines.length - 1] += ' | ' + line;
    } else {
      mergedLines.push(line);
    }
  }
  const lines = mergedLines;

  // Detect 11-column CSV output
  const isCSV = lines[0].toLowerCase().includes('scenario tid') || lines[0].split(',').length >= 6;

  if (isCSV) {
    const headers = ["Scenario TID", "Type (Positive/Negative)", "Scenario Description", "Test Case ID", "Pre-Condition", "Steps to Execute", "Expected Result", "Actual Result", "Status (Pass/Fail)", "Executed QA Name", "Comments"];
    const widths = ["80px", "100px", "180px", "80px", "140px", "320px", "280px", "90px", "90px", "100px", "90px"];

    let html = '';
    html += '<div style="width:100%;overflow-x:auto;margin:15px 0;">';
    html += '<table style="width:100%;border-collapse:collapse;min-width:1500px;table-layout:fixed;font-size:0.875rem;">';
    html += '<thead><tr>';

    headers.forEach(function (h, idx) {
      html += '<th style="width:' + widths[idx] + ';padding:9px 10px;border:1px solid #555;background:#1e293b;text-align:left;color:#cbd5e1;font-weight:700;font-size:0.8rem;">' + h + '</th>';
    });
    html += '</tr></thead><tbody>';

    const startIndex = lines[0].toLowerCase().includes('scenario') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      html += '<tr style="border-bottom:1px solid #333;">';

      for (let j = 0; j < 11; j++) {
        let cellText = (cells[j] || '').trim().replace(/^"|"$/g, '');

        // HARD ENFORCEMENT: Override column values regardless of AI output
        if (j === 7) { cellText = ''; }      // Actual Result → always EMPTY
        if (j === 8) { cellText = ''; }      // Status (Pass/Fail) → always EMPTY
        if (j === 9) { cellText = 'Maruf'; } // Executed QA Name → always Maruf
        if (j === 10) { cellText = ''; }     // Comments → always EMPTY

        // Format Steps to Execute (col 5) — always numbered line-by-line
        if (j === 5) {
          const parts = cellText.split('|');
          cellText = parts.map(function (step, n) {
            const cleanStep = step.trim().replace(/^(\d+[\.):\s]+|Step\s*\d+[:\s]*)/i, '').trim();
            return cleanStep ? (n + 1) + '. ' + cleanStep : '';
          }).filter(function (s) { return s.trim().length > 2; })
            .join('<br>');
        }

        // Format Expected Result (col 6) — split by pipe and wrap each point
        if (j === 6) {
          if (cellText.includes('|')) {
            const parts = cellText.split('|');
            cellText = parts.map(function (point) {
              return point.trim().replace(/^(\d+[\.):\s]+)/i, '').trim();
            }).filter(function (s) { return s.trim().length > 2; })
              .join('<br>');
          }
          // If no pipe, just leave as plain wrapped text
        }

        // Set custom cell style for Steps and Expected Result columns
        let tdStyle = 'padding:8px 10px;border:1px solid #555;vertical-align:top;word-break:break-word;word-wrap:break-word;white-space:normal;line-height:1.7;color:#e2e8f0;font-size:0.875rem;';

        html += '<td style="' + tdStyle + '">' + (cellText || '') + '</td>';
      }
      html += '</tr>';
    }

    html += '</tbody></table></div>';
    return html;
  }

  // Fallback: render as Markdown
  if (window.marked) {
    return marked.parse(content);
  }
  return content.replace(/\n/g, '<br>');
}

generateBtn.addEventListener('click', async () => {
  const query = queryInput.value.trim()

  if (!query && !attachedFileContent) {
    alert('Please enter a query or requirement, or attach a document.')
    return
  }

  let finalQuery = query;
  if (attachedFileContent) {
    const documentContext = `\n\n-- - REQUIRED CONTEXT FROM ATTACHED DOCUMENT(${attachedFileName})-- -\n${attachedFileContent.substring(0, 30000)} `;
    if (finalQuery) {
      finalQuery += documentContext;
    } else {
      finalQuery = `Generate test cases based on the following document context:${documentContext} `;
    }
  }

  // UI Loading State
  generateBtn.disabled = true
  btnText.textContent = 'Generating...'
  btnLoader.style.display = 'block'
  resultContainer.classList.add('hidden')

  try {
    const result = await generateTestCase(finalQuery)
    lastGeneratedResult = result;

    // Display result
    testCaseOutput.innerHTML = formatMarkdown(result)
    resultContainer.classList.remove('hidden')

    // Scroll to result
    resultContainer.scrollIntoView({ behavior: 'smooth' })
  } catch (error) {
    alert(`Error: ${error.message} `)
  } finally {
    generateBtn.disabled = false
    btnText.textContent = 'Generate Test Case'
    btnLoader.style.display = 'none'
  }
})

copyBtn.addEventListener('click', () => {
  const text = testCaseOutput.innerText
  navigator.clipboard.writeText(text).then(() => {
    const originalText = copyBtn.textContent
    copyBtn.textContent = 'Copied!'
    setTimeout(() => {
      copyBtn.textContent = originalText
    }, 2000)
  })
})

exportCsvBtn.addEventListener('click', () => {
  if (!lastGeneratedResult) return;

  const csvRows = parseTestCasesToCSV(lastGeneratedResult);
  if (csvRows.length === 0) {
    alert("Could not extract structured test cases properly. The AI output might be malformed or not a valid markdown table.");
    return;
  }

  downloadCSV(csvRows);
});

function parseTestCasesToCSV(markdown) {
  // Pre-process: rejoin ONLY zero-comma lines (pure step continuations)
  const rawLines = markdown.trim().split('\n');
  const mergedLines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;
    const commaCount = (line.match(/,/g) || []).length;
    if (commaCount === 0 && mergedLines.length > 0) {
      mergedLines[mergedLines.length - 1] += ' | ' + line;
    } else {
      mergedLines.push(line);
    }
  }

  const csvRows = [];
  const requiredHeader = 'Scenario TID,Type (Positive/Negative),Scenario Description,Test Case ID,Pre-Condition,Steps to Execute,Expected Result,Actual Result,Status (Pass/Fail),Executed QA Name,Comments';
  csvRows.push(requiredHeader.split(','));

  const startIndex = mergedLines[0].toLowerCase().includes('scenario') ? 1 : 0;
  for (let i = startIndex; i < mergedLines.length; i++) {
    const line = mergedLines[i].trim();
    if (!line) continue;
    const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''));
    // Pad to 11 columns
    while (cells.length < 11) cells.push('');
    const row = cells.slice(0, 11);
    // Always enforce: Actual Result (7), Status (8), Comments (10) are empty
    row[7] = '';
    row[8] = '';
    row[10] = '';
    // Always enforce: Executed QA Name (9) is Maruf
    row[9] = 'Maruf';
    csvRows.push(row);
  }

  return csvRows;
}

function downloadCSV(csvRows) {
  const csvContentArray = csvRows.map(row => {
    return row.map(cell => {
      if (!cell) return '""';
      return '"' + cell.replace(/"/g, '""') + '"';
    }).join(',');
  });

  const csvContent = "\uFEFF" + csvContentArray.join('\n'); // Add BOM for Excel UTF-8
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "Generated_Test_Cases.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) {
    attachedFileContent = null;
    attachedFileName = null;
    fileUploadText.textContent = 'Choose a file or drag it here (.txt, .md, .pdf, .docx)...';
    fileContentPreview.classList.add('hidden');
    return;
  }

  attachedFileName = file.name;
  fileUploadText.textContent = `Attached: ${file.name} `;
  fileContentPreview.classList.remove('hidden');
  fileContentPreview.textContent = 'Reading file...';

  try {
    const extension = file.name.split('.').pop().toLowerCase();

    if (['txt', 'md', 'csv', 'json'].includes(extension)) {
      attachedFileContent = await readFileAsText(file);
    } else if (extension === 'pdf') {
      attachedFileContent = await readPdfContent(file);
    } else if (extension === 'docx') {
      attachedFileContent = await readDocxContent(file);
    } else {
      throw new Error("Unsupported file format.");
    }

    fileContentPreview.textContent = `File loaded successfully(${attachedFileContent.length} characters).`;
  } catch (error) {
    console.error("Error reading file:", error);
    fileContentPreview.textContent = `Error reading file: ${error.message} `;
    attachedFileContent = null;
  }
});

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error("Failed to read text file."));
    reader.readAsText(file);
  });
}

async function readPdfContent(file) {
  if (!window.pdfjsLib) throw new Error("PDF.js library not loaded.");
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
  let text = '';
  // Limit to first 20 pages to avoid huge prompts
  const maxPages = Math.min(pdf.numPages, 20);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    text += pageText + '\n\n';
  }
  return text;
}

async function readDocxContent(file) {
  if (!window.mammoth) throw new Error("Mammoth library not loaded.");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}
