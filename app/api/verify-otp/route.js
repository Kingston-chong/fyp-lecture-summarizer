import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { email, otp } = await req.json()

    if (!email || !otp) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const record = await prisma.passwordReset.findUnique({
      where: { email },
    })

    if (!record) {
      return NextResponse.json({ error: 'No OTP request found' }, { status: 404 })
    }

    if (record.used) {
      return NextResponse.json({ error: 'OTP already used' }, { status: 400 })
    }

    if (record.expiresAt < new Date()) {
      return NextResponse.json({ error: 'OTP expired' }, { status: 400 })
    }

    // If you hashed OTP:
    // const isValid = await bcrypt.compare(otp, record.otp)
    // if (!isValid) ...

    if (record.otp !== otp) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 })
    }

    await prisma.passwordReset.update({
      where: { email },
      data: { used: true },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}