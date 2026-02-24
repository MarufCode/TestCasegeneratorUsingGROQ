import './style.css'

const queryInput = document.getElementById('query-input')
const generateBtn = document.getElementById('generate-btn')
const btnText = generateBtn.querySelector('.btn-text')
const btnLoader = document.getElementById('btn-loader')
const resultContainer = document.getElementById('result-container')
const testCaseOutput = document.getElementById('test-case-output')
const copyBtn = document.getElementById('copy-btn')

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY

async function generateTestCase(query) {
  const prompt = `You are a professional QA Engineer. Generate comprehensive manual test cases for the following requirement: "${query}". 
  Provide the output in a clear format including: 
  1. Test Case ID
  2. Test Description
  3. Pre-requisites
  4. Test Steps
  5. Expected Result
  6. Priority (High/Medium/Low)
  Use markdown formatting.`

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
            content: 'You are a helpful assistant that generates detailed software test cases.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2048
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Failed to generate test cases')
    }

    const data = await response.json()
    return data.choices[0].message.content
  } catch (error) {
    console.error('Error calling Groq API:', error)
    throw error
  }
}

function formatMarkdown(content) {
  // Very simple markdown to HTML conversion for high-level structure
  return content
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/\n/g, '<br>')
}

generateBtn.addEventListener('click', async () => {
  const query = queryInput.value.trim()
  
  if (!query) {
    alert('Please enter a query or requirement.')
    return
  }

  // UI Loading State
  generateBtn.disabled = true
  btnText.textContent = 'Generating...'
  btnLoader.style.display = 'block'
  resultContainer.classList.add('hidden')

  try {
    const result = await generateTestCase(query)
    
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
