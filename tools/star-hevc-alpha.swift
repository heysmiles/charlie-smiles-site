// Encode a PNG frame sequence (with alpha) into an HEVC-with-alpha QuickTime
// movie, for Safari. Usage: swift encode.swift <framesDir> <prefix> <fps> <out.mov>
import AVFoundation
import AppKit
import VideoToolbox

let args = CommandLine.arguments
guard args.count == 6 else { fputs("usage: encode.swift <framesDir> <prefix> <fps> <out.mov> <quality>\n", stderr); exit(1) }
let dir = args[1], prefix = args[2], fps = Int32(args[3])!, outPath = args[4], quality = Double(args[5])!
let files = try! FileManager.default.contentsOfDirectory(atPath: dir).filter { $0.hasPrefix(prefix) && $0.hasSuffix(".png") }.sorted()
guard let first = files.first, let img0 = NSImage(contentsOfFile: dir + "/" + first)?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { fputs("no frames\n", stderr); exit(1) }
let w = img0.width, h = img0.height
try? FileManager.default.removeItem(atPath: outPath)
let writer = try! AVAssetWriter(outputURL: URL(fileURLWithPath: outPath), fileType: .mov)
let settings: [String: Any] = [
  AVVideoCodecKey: AVVideoCodecType.hevcWithAlpha,
  AVVideoWidthKey: w, AVVideoHeightKey: h,
  AVVideoCompressionPropertiesKey: [
    AVVideoQualityKey: quality,
    kVTCompressionPropertyKey_TargetQualityForAlpha as String: min(0.9, quality + 0.15),
  ],
]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
  kCVPixelBufferWidthKey as String: w, kCVPixelBufferHeightKey as String: h,
])
writer.add(input)
writer.startWriting(); writer.startSession(atSourceTime: .zero)
var i: Int64 = 0
for f in files {
  guard let img = NSImage(contentsOfFile: dir + "/" + f)?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
  var pb: CVPixelBuffer?
  CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
  guard let buf = pb else { continue }
  CVPixelBufferLockBaseAddress(buf, [])
  let ctx = CGContext(data: CVPixelBufferGetBaseAddress(buf), width: w, height: h, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buf), space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
  ctx.clear(CGRect(x: 0, y: 0, width: w, height: h))
  ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
  CVPixelBufferUnlockBaseAddress(buf, [])
  while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.005) }
  adaptor.append(buf, withPresentationTime: CMTime(value: i, timescale: fps))
  i += 1
}
input.markAsFinished()
let sem = DispatchSemaphore(value: 0)
writer.finishWriting { sem.signal() }
sem.wait()
if writer.status == .completed { print("wrote \(outPath): \(i) frames at \(fps) fps, \(w)x\(h)") } else { fputs("failed: \(String(describing: writer.error))\n", stderr); exit(1) }
