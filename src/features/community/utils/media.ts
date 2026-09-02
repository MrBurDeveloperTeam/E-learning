const MAX_IMAGE_EDGE=1920

export async function prepareCommunityMedia(file:File):Promise<File>{
  if(!file.type.startsWith('image/')||file.type==='image/gif'||file.size<1_000_000)return file
  const bitmap=await createImageBitmap(file),scale=Math.min(1,MAX_IMAGE_EDGE/Math.max(bitmap.width,bitmap.height))
  if(scale===1){bitmap.close();return file}
  const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale)
  const context=canvas.getContext('2d');if(!context){bitmap.close();return file}context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close()
  const mime=file.type==='image/png'?'image/png':'image/webp',blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,mime,.84))
  if(!blob||blob.size>=file.size)return file
  return new File([blob],file.name.replace(/\.[^.]+$/,mime==='image/png'?'.png':'.webp'),{type:mime,lastModified:file.lastModified})
}
