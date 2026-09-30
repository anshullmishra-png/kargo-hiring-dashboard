import UploadForm from '@/components/UploadForm'
import Shell from '@/components/Shell'

export default function UploadPage() {
  return (
    <Shell
      eyebrow="Step one"
      title="Upload CVs."
      sub="Pick the role, drop the files. Personal details are split off before anything reaches the AI."
      pill="Private by design"
    >
      <UploadForm />
    </Shell>
  )
}
