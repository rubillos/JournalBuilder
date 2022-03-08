//
//  main.swift
//  PhotoList
//
//  Created by Randy on 3/6/22.
//

import Foundation
import ArgumentParser
import Photos

struct ListPhotos: ParsableCommand {
	@Argument(help: "Name of album") var albumName: String
  
	func run() throws {
		func scanAlbum(album: PHAssetCollection) {
			func currentURL(resources: [PHAssetResource]) -> String {
				for desc in resources.description.components(separatedBy: "PHAssetResource") {
					if (desc.contains("type: photo") && desc.contains("isCurrent: YES")) {
						let regex = try! NSRegularExpression(pattern: "(?<=fileURL: ).*(?=\\s)")
						if let result = regex.firstMatch(in: desc, options: [], range: NSRange(location: 0, length: desc.count)) {
							return String(desc[Range(result.range, in: desc)!])
						}
						else {
							return("URL not decoded")
						}
					}
				}
				return("URL not found")
			}
			
			let photoAssets = PHAsset.fetchAssets(in: album, options: nil) as! PHFetchResult<AnyObject>

			print(photoAssets.count)

			photoAssets.enumerateObjects{(object: AnyObject!, _, _) in
				if object is PHAsset {
					let asset = object as! PHAsset

					if asset.mediaType == .image && !asset.isHidden {
						let resources = PHAssetResource.assetResources(for: asset)
						let separator = "\t"
						
						print(resources[0].originalFilename, terminator: separator)
						print(currentURL(resources:resources),terminator: separator)
						print(asset.creationDate!,terminator: separator)
						print(asset.pixelWidth,terminator: separator)
						print(asset.pixelHeight,terminator: separator)
						print(asset.isFavorite)
					}
				}
			}
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


