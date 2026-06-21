from fastapi import FastAPI, UploadFile, File
import easyocr
import fitz
import tempfile
import os

app = FastAPI()

reader = easyocr.Reader(
    ['hi', 'en'],
    gpu=False
)


@app.post("/ocr")
async def process_pdf(file: UploadFile = File(...)):

    with tempfile.NamedTemporaryFile(
        delete=False,
        suffix=".pdf"
    ) as temp_pdf:

        content = await file.read()
        temp_pdf.write(content)

        pdf_path = temp_pdf.name

    try:

        doc = fitz.open(pdf_path)

        page = doc[0]

        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))

        image_path = pdf_path.replace(
            ".pdf",
            ".png"
        )

        pix.save(image_path)
        doc.close()

        results = reader.readtext(
            image_path
        )

        text_parts = []
        confidences = []

        for result in results:

            text = result[1]
            confidence = result[2]

            text_parts.append(text)
            confidences.append(confidence)

        extracted_text = "\n".join(text_parts)

        avg_confidence = 0

        if confidences:
            avg_confidence = (
                sum(confidences)
                / len(confidences)
            ) * 100

        import base64
        with open(image_path, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')

        os.remove(image_path)
        os.remove(pdf_path)

        return {
            "method": "easyocr",
            "text": extracted_text,
            "confidence": round(
                avg_confidence,
                2
            ),
            "character_count": len(extracted_text),
            "image_base64": encoded_string
        }

    except Exception as e:

        return {
            "error": str(e)
        }