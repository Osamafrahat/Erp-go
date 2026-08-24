import crypto from 'crypto'
import axios from 'axios'

const ETA_IDENTITY_URL = 'https://idnt.eta.gov.eg/connect/token'
const ETA_API_URL = 'https://api.invoicing.eta.gov.eg/api/v1.0'
const ETA_PORTAL_URL = 'https://invoicing.eta.gov.eg'

let cachedToken = null
let tokenExpiry = 0

export function getEtaConfig(settings) {
  return {
    clientId: settings?.eta_client_id || process.env.ETA_CLIENT_ID || '',
    clientSecret: settings?.eta_client_secret || process.env.ETA_CLIENT_SECRET || '',
    posSerial: settings?.eta_pos_serial || process.env.ETA_POS_SERIAL || '',
    posSerialNumber: settings?.eta_pos_serial_number || process.env.ETA_POS_SERIAL_NUMBER || '',
    registrationNumber: settings?.eta_registration_number || process.env.ETA_REGISTRATION_NUMBER || '',
    portalUrl: settings?.eta_portal_url || ETA_PORTAL_URL,
    baseUrl: settings?.eta_api_url || ETA_API_URL,
    identityUrl: settings?.eta_identity_url || ETA_IDENTITY_URL,
  }
}

export async function authenticatePos(config) {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken
  }

  const params = new URLSearchParams()
  params.append('grant_type', 'client_credentials')
  params.append('client_id', config.clientId)
  params.append('client_secret', config.clientSecret)

  const response = await axios.post(config.identityUrl, params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'posserial': config.posSerial,
      'pososversion': '1.0',
      'posmodelframework': '1',
      'presharedkey': config.clientSecret,
    },
  })

  cachedToken = response.data.access_token
  tokenExpiry = Date.now() + ((response.data.expires_in || 3600) - 300) * 1000
  return cachedToken
}

export function generateEtaUUID(receiptData) {
  const normalized = normalizeReceipt(receiptData)
  const hash = crypto.createHash('sha256').update(normalized).digest('hex')
  return hash
}

function normalizeReceipt(data) {
  const flat = {}
  flattenObject(data, '', flat)
  const sortedKeys = Object.keys(flat).sort()
  return sortedKeys.map(k => `${k}:${flat[k]}`).join(',')
}

function flattenObject(obj, prefix, result) {
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    const val = obj[key]
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      flattenObject(val, fullKey, result)
    } else if (Array.isArray(val)) {
      val.forEach((item, i) => {
        if (item && typeof item === 'object') {
          flattenObject(item, `${fullKey}[${i}]`, result)
        } else {
          result[`${fullKey}[${i}]`] = item
        }
      })
    } else if (val !== undefined && val !== null) {
      result[fullKey] = String(val)
    }
  }
}

export function buildReceiptDocument(order, settings, items) {
  const config = getEtaConfig(settings)
  const now = new Date().toISOString()

  const invoiceLines = items.map((item, idx) => ({
    sequence: idx + 1,
    description: item.product?.name || item.name || '',
    quantity: item.quantity || 1,
    unitPrice: item.unit_price || item.price || 0,
    salesTotal: (item.unit_price || item.price || 0) * (item.quantity || 1),
    total: (item.unit_price || item.price || 0) * (item.quantity || 1),
    discount: {
      amount: 0,
      rate: 0,
    },
    value: {
      taxRate: settings?.taxRate || 14,
      taxType: 'T',
      amount: ((item.unit_price || item.price || 0) * (item.quantity || 1) * (settings?.taxRate || 14)) / 100,
    },
  }))

  const subtotal = items.reduce((sum, item) => sum + (item.unit_price || item.price || 0) * (item.quantity || 1), 0)
  const taxAmount = (subtotal * (settings?.taxRate || 14)) / 100

  const receiptData = {
    issuer: {
      type: 'B',
      id: config.registrationNumber,
      name: settings?.storeName || '',
      street: settings?.storeAddress || '',
      branchID: '0',
      country: 'EG',
      governate: settings?.storeGovernate || 'Cairo',
      regionCity: settings?.storeRegionCity || 'Cairo',
      postalCode: settings?.storePostalCode || '',
      buildingNumber: settings?.storeBuildingNumber || '0',
    },
    receiver: {
      type: 'B',
      id: order.customer_tax_id || 'NA',
      name: order.customer_name || 'Customer',
      street: '',
      country: 'EG',
      governate: '',
      regionCity: '',
      postalCode: '',
      buildingNumber: '0',
    },
    documentType: 'i',
    documentTypeVersion: '1.0',
    dateTimeIssued: now,
    taxpayerActivityCode: settings?.eta_activity_code || '',
    internalID: order.order_number || `INV-${Date.now()}`,
    invoiceLines,
    totalDiscountAmount: order.discount_amount || 0,
    totalSalesAmount: subtotal,
    netAmount: subtotal - (order.discount_amount || 0),
    totalAmount: subtotal - (order.discount_amount || 0) + taxAmount,
    taxTotals: [{
      taxType: 'T',
      taxRate: settings?.taxRate || 14,
      amount: taxAmount,
    }],
    extraData: {
      paymentMethod: order.payment_method || 'C',
    },
  }

  return receiptData
}

export function generateQrCode(receiptData, uuid, config) {
  const dateTime = receiptData.dateTimeIssued
  const total = receiptData.totalAmount?.toFixed(3) || '0.000'
  const portalUrl = config.portalUrl

  const qrContent = `${portalUrl}/receipts/search/${uuid}/share/${dateTime}#Total:${total},IssuerRIN:${config.registrationNumber}`

  return qrContent
}

export async function submitToEta(receiptData, uuid, config) {
  const token = await authenticatePos(config)

  const document = {
    ...receiptData,
    uuid,
    signatures: [],
  }

  const submission = {
    documents: [document],
    submissionUUID: generateEtaUUID({ ...receiptData, submissionTime: Date.now() }),
  }

  const response = await axios.post(`${config.baseUrl}/documentsubmissions/`, submission, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  return {
    submissionUUID: response.data.submissionUUID,
    acceptedDocuments: response.data.acceptedDocuments || [],
    rejectedDocuments: response.data.rejectedDocuments || [],
    etaUUID: response.data.acceptedDocuments?.[0]?.uuid || uuid,
  }
}

export async function getDocumentStatus(etaUUID, config) {
  const token = await authenticatePos(config)

  const response = await axios.get(`${config.baseUrl}/documents/${etaUUID}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  return response.data
}

export function invalidateToken() {
  cachedToken = null
  tokenExpiry = 0
}
