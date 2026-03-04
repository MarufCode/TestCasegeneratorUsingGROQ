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
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are a QA automation lead operating under strict anti-hallucination rules.

## MISSION
Your objective is to generate manual test cases for functionalities and scenarios EXPLICITLY provided in the context.

## SCOPE OF KNOWLEDGE
You may ONLY use information explicitly provided in the PRD, API documentation, Logs, Screenshots, Test data, or User input provided in the prompt.

## STRICT RULES (MANDATORY)
1. DO NOT invent features, APIs, error codes, UI elements, or behavior.
2. DO NOT assume default or "typical" system behavior.
3. If information is missing or unclear for a specific element, respond with: "Insufficient information to determine for [feature]."
4. Every assertion must be traceable to provided input. 
5. If a detail is inferred, label it explicitly as: "Inference (low confidence)".
6. Output must be deterministic and repeatable.
7. Focus on depth (positive paths, negative paths, boundary cases) but ONLY within the provided facts.

## PROCESS YOU MUST FOLLOW
Step 1: Extract verifiable facts from the input.
Step 2: List unknown or missing information.
Step 3: Generate output ONLY from Step 1 facts. This MUST be a single Markdown table.
Step 4: Perform a self-check for hallucinations or contradictions.

## OUTPUT FORMAT (STRICT)
- Verified Facts: 
- Missing / Unknown Information:
- Generated Output:
[Your Markdown Table]
- Self-Validation Check:

## TABLE SPECIFICATIONS
- Detect columns requested in the query. If none, use: Test Case ID | Description | Pre-requisites | Test Steps | Expected Result | Priority.
- ALL test cases must be inside the table.

If you cannot complete a step, stop and report why.`
          },
          {
            role: 'user',
            content: `User Requirements and Context:
"${query}"

Generate the test cases adhering strictly to the anti-hallucination process.`
          }
        ],
        temperature: 0,
        max_tokens: 6000
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
    const documentContext = `\n\n--- REQUIRED CONTEXT FROM ATTACHED DOCUMENT (${attachedFileName}) ---\n${attachedFileContent.substring(0, 30000)}`;
    if (finalQuery) {
      finalQuery += documentContext;
    } else {
      finalQuery = `Generate test cases based on the following document context:${documentContext}`;
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
    alert(`Error: ${error.message}`)
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
  const lines = markdown.split('\n');
  const csvRows = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (!inTable) {
        if (trimmed.includes('---')) {
          continue; // Separator line
        }
        inTable = true;
      }

      const row = trimmed.substring(1, trimmed.length - 1).split('|').map(cell => cell.trim());

      const isSeparator = row.every(cell => /^[-: ]+$/.test(cell));
      if (!isSeparator) {
        csvRows.push(row);
      }
    } else {
      if (inTable) {
        // Assume table is finished
        inTable = false;
      }
    }
  }

  if (csvRows.length === 0 && markdown.trim().length > 0) {
    csvRows.push(['Raw Output']);
    csvRows.push([markdown]);
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
  fileUploadText.textContent = `Attached: ${file.name}`;
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

    fileContentPreview.textContent = `File loaded successfully (${attachedFileContent.length} characters).`;
  } catch (error) {
    console.error("Error reading file:", error);
    fileContentPreview.textContent = `Error reading file: ${error.message}`;
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
