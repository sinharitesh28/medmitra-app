$User = "gemini-cli"
$IP = "136.116.93.95"
$Key = "keys/gcp_vm_key"

ssh -i $Key -o StrictHostKeyChecking=no $User@$IP $args
