//
//  main.swift
//  PhotoList
//
//  Created by Randy on 3/6/22.
//

import Foundation
import ArgumentParser
import Photos
import UniformTypeIdentifiers

struct ListPhotos: ParsableCommand {
	@Argument(help: "Name of album") var albumName: String
	@Option(name: .shortAndLong, help: "path to image files") var path = "/tmp/journalbuilder"
	@Flag(name: .shortAndLong, help: "favorites only (default: all files)") var favorites = false
  
	func run() throws {
		func scanAlbum(album: PHAssetCollection) {
			
			let photoAssets = PHAsset.fetchAssets(in: album, options: nil)

			print(photoAssets.count)

			let imageManager = PHImageManager.default()
			let imageRequestOptions = PHImageRequestOptions()
			imageRequestOptions.deliveryMode = .highQualityFormat
			imageRequestOptions.isSynchronous = true
			imageRequestOptions.isNetworkAccessAllowed = true
			imageRequestOptions.version = .current

			let fileManager = FileManager.default
			
			photoAssets.enumerateObjects{(asset, _, _) in
				
				if asset.mediaType == .image && !asset.isHidden {
					let resources = PHAssetResource.assetResources(for: asset)
					let separator = "\t"
					
					let uuid = asset.localIdentifier
					var filepath = path + "/" + uuid.replacingOccurrences(of: "/", with: "_")
					let modDate = asset.modificationDate
					if let modDate = modDate {
						let dateFormatter = DateFormatter()
						dateFormatter.dateFormat = "yyyyMMdd_HHmmss"
						let dateString = dateFormatter.string(from: modDate)
						filepath = filepath + dateString
					}

					if (asset.isFavorite || !favorites) {
						if (!fileManager.fileExists(atPath: filepath)) {
							let directoryURL = URL(fileURLWithPath: filepath)
							do {
								try fileManager.createDirectory(at: directoryURL, withIntermediateDirectories: true)

								imageManager.requestImageDataAndOrientation(for: asset, options: imageRequestOptions) { data, uti, orientation, info in
									
									if let imageData = data, let uti = uti {
										if let ext = UTType(uti)?.preferredFilenameExtension {
											filepath = filepath + "/" + "image." + ext
										} else {
											filepath = filepath + "/" + "image"
										}
										
										let fileURL = URL(fileURLWithPath: filepath)
										do {
											// Write the image data to the file
											try imageData.write(to: fileURL, options: .atomic)
										} catch {
											// Handle error
											return
										}
									}
								}
							} catch {
								// Handle error
								return
							}
						} else {
							do {
								let items = try fileManager.contentsOfDirectory(atPath: filepath)
								
								if let file = items.first {
									filepath = filepath + "/" + file
								}
							} catch {
								// Handle error
								return
							}
						}
					}
					
					print(resources[0].originalFilename, terminator: separator)
					print(URL(fileURLWithPath: filepath), terminator: separator)
					print(asset.creationDate!,terminator: separator)
					print(asset.pixelWidth,terminator: separator)
					print(asset.pixelHeight,terminator: separator)
					if let title = asset.value(forKey: "title") as? String {
						print(title, terminator: separator)
					} else {
					  print("", terminator: separator)
					}
					print(asset.isFavorite)
				}
			}
		}
		
		let fm = FileManager.default
		if (!fm.fileExists(atPath: path)) {
			let directoryURL = URL(fileURLWithPath: path)
			try fm.createDirectory(at: directoryURL, withIntermediateDirectories: true)
		}
		
		setbuf(__stdoutp, nil);
		
		let fetchOptions = PHFetchOptions()

		fetchOptions.predicate = NSPredicate(format: "title = %@", albumName)
		
		let albums:PHFetchResult = PHAssetCollection.fetchAssetCollections(with: .album, subtype: .any, options: fetchOptions)
		
		if (albums.count > 0) {
			albums.enumerateObjects{ (object: AnyObject!, _, _) in
				if object is PHAssetCollection {
					scanAlbum(album: object as! PHAssetCollection)
				}
			}
		}
		else {
			print("0")
		}
	}
}

ListPhotos.main()


