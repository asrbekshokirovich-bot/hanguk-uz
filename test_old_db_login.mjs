import { createClient } from '@supabase/supabase-js'

const oldUrl = 'https://hyvxwlwttzxzrkfolivo.supabase.co'
const oldAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5dnh3bHd0dHp4enJrZm9saXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0OTY5ODIsImV4cCI6MjA4MzA3Mjk4Mn0.hNQmGCpoO_SUfzWRJ4PMLnAc11zEYUyAJGISjWOkahQ'

const supabase = createClient(oldUrl, oldAnonKey)

async function testLoginAndExtract() {
  console.log('Logging into old Supabase database...')
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'asrbekshokirovich@gmail.com',
    password: 'Sadulaev$$@@##512' // Credentials user provided earlier
  })

  if (authError) {
    console.error('Login Failed:', authError.message)
    return
  }

  console.log('Login Success! User ID:', authData.user.id)
  console.log('Attempting to read magic_access_codes...')

  const { data: codes, error: codeError } = await supabase
    .from('magic_access_codes')
    .select('*')
    .limit(5)

  if (codeError) {
    console.error('Read Failed:', codeError.message)
  } else {
    console.log(`Read Success! Found ${codes.length} codes. Example:`, codes[0] || 'none')
  }
}

testLoginAndExtract()
