import DocumentUploader from '../../components/features/ocr/DocumentUploader'

export default function VerifyDocumentPage() {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Verify Document</h1>
      <DocumentUploader />
    </div>
  )
}